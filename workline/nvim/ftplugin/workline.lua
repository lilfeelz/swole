-- workline buffers in a swole checkout: run the CLI for start/stop/save and
-- lint on write. Needs node and this repository; see README.md.

local function root()
  return vim.fs.root(0, function(name, path)
    return name == "package.json" and vim.uv.fs_stat(path .. "/src/cli.js") ~= nil
  end)
end

local function reload()
  if not vim.bo.modified then vim.cmd.edit() end
end

local function run(args, after)
  local dir = root()
  if not dir then
    vim.notify("swole: not inside a swole checkout", vim.log.levels.ERROR)
    return
  end
  vim.system(vim.list_extend({ "node", "src/cli.js" }, args), { cwd = dir, text = true }, function(out)
    vim.schedule(function()
      if out.code ~= 0 then
        local err = vim.trim(out.stderr)
        if err == "" then err = vim.trim(out.stdout) end
        vim.notify(("swole %s: %s"):format(table.concat(args, " "), err), vim.log.levels.ERROR)
        return
      end
      local msg = vim.trim(out.stdout)
      if msg ~= "" then vim.notify(msg) end
      if after then after(dir) end
    end)
  end)
end

local function validate(silent)
  local dir = root()
  if not dir then return end
  vim.system({ "node", "src/cli.js", "validate" }, { cwd = dir, text = true }, function(out)
    vim.schedule(function()
      local items = {}
      for _, line in ipairs(vim.split(out.stderr or "", "\n")) do
        local file, lnum, msg = line:match("^(.-):(%d+): (.*)$")
        if file then
          items[#items + 1] = { filename = vim.fs.joinpath(dir, file), lnum = tonumber(lnum), text = msg }
        end
      end
      vim.fn.setqflist(items, "r")
      if #items > 0 then
        vim.notify(("%d workline error(s); see :copen"):format(#items), vim.log.levels.WARN)
        if not silent then vim.cmd.copen() end
      elseif not silent then
        vim.notify("workline ok")
      end
    end)
  end)
end

local function unsaved()
  if vim.bo.modified then
    vim.notify("swole: write the buffer first", vim.log.levels.WARN)
    return true
  end
end

vim.bo.commentstring = "# %s"

vim.api.nvim_buf_create_user_command(0, "SwoleStart", function(opts)
  run(vim.list_extend({ "start" }, opts.fargs), function(dir)
    vim.cmd.edit(vim.fn.fnameescape(vim.fs.joinpath(dir, "data/session.txt")))
  end)
end, { nargs = "?", desc = "Start a swole session" })

vim.api.nvim_buf_create_user_command(0, "SwoleStop", function()
  if unsaved() then return end
  run({ "stop" }, reload)
end, { desc = "Stop the active swole session" })

vim.api.nvim_buf_create_user_command(0, "SwoleSave", function()
  if unsaved() then return end
  run({ "save" }, reload)
end, { desc = "Save the active swole session" })

vim.api.nvim_buf_create_user_command(0, "SwoleValidate", function() validate(false) end, {
  desc = "Lint routine, session and log files",
})

vim.api.nvim_create_autocmd("BufWritePost", {
  group = vim.api.nvim_create_augroup("swole_" .. vim.api.nvim_get_current_buf(), { clear = true }),
  buffer = 0,
  callback = function() validate(true) end,
})
