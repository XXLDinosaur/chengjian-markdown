const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  windowControl:action=>ipcRenderer.invoke('window-control',action),
  editCommand:command=>ipcRenderer.invoke('edit-command',command),
  pasteWord:data=>ipcRenderer.invoke('paste-word',data),
  draftRead:()=>ipcRenderer.invoke('draft-read'), draftWrite:data=>ipcRenderer.invoke('draft-write',data),
  renameDocument:name=>ipcRenderer.invoke('rename-document',name), floatWindow:enabled=>ipcRenderer.invoke('float-window',enabled),
  printDocument:()=>ipcRenderer.invoke('print-document'), themeImage:()=>ipcRenderer.invoke('theme-image'),
  initial: () => ipcRenderer.invoke('initial'), open: () => ipcRenderer.invoke('open'), newDocument: () => ipcRenderer.invoke('new'),
  dirty: value => ipcRenderer.invoke('dirty', value), confirmLeave: () => ipcRenderer.invoke('confirm-leave'),
  save: data => ipcRenderer.invoke('save', data), image: () => ipcRenderer.invoke('image'), pasteImage: () => ipcRenderer.invoke('paste-image'),
  droppedImage: image => ipcRenderer.invoke('dropped-image', image),
  resolveImages: sources => ipcRenderer.invoke('resolve-images', sources), externalLink: url => ipcRenderer.invoke('external-link', url),
  closeResult: allow => ipcRenderer.invoke('close-result', allow), onClose: callback => ipcRenderer.on('request-close', callback)
});
