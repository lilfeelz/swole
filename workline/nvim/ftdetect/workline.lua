vim.filetype.add({
  extension = { workline = "workline", wl = "workline" },
  pattern = {
    [".*/data/routine%.txt"] = "workline",
    [".*/data/session%.txt"] = "workline",
    [".*/data/log/.*%.txt"] = "workline",
  },
})
