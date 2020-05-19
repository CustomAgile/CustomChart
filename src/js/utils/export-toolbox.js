Ext.define("CustomAgile.utils.Toolbox", { singleton: !0, saveCSVToFile: function (a, b, c) { void 0 === c && (c = { type: "text/csv;charset=utf-8" }), this.saveAs(a, b, c) }, saveAs: function (a, b) { if (Ext.isIE9m) return void Rally.ui.notify.Notifier.showWarning({ message: "Export is not supported for IE9 and below." }); var c = null; try { c = new Blob([a], { type: "text/plain" }) } catch (d) { window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder, window.BlobBuilder && "TypeError" == d.name && (bb = new BlobBuilder, bb.append([a]), c = bb.getBlob("text/plain")) } if (!c) return void Rally.ui.notify.Notifier.showWarning({ message: "Export is not supported for this browser." }); var e = b; if (Ext.isIE10p) return void window.navigator.msSaveOrOpenBlob(c, e); var f = this.createObjectURL(c); if (f) { var g = document.createElement("a"); "download" in g ? g.download = e : g.target = "_blank", g.innerHTML = "Download File", g.href = f, Ext.isChrome || (g.onclick = this.destroyClickedElement, g.style.display = "none", document.body.appendChild(g)), g.click() } else Rally.ui.notify.Notifier.showError({ message: "Export is not supported " }) }, createObjectURL: function (a) { return window.webkitURL ? window.webkitURL.createObjectURL(a) : window.URL && window.URL.createObjectURL ? window.URL.createObjectURL(a) : null }, destroyClickedElement: function (a) { document.body.removeChild(a.target) } })