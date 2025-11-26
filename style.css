:root {
    --bg-color: #F8F8F8;
    --card-bg: #FFFFFF;
    --primary: #111111;
    --accent: #007AFF; /* iOS Blue */
    --text-main: #111111;
    --text-sub: #888888;
    --border: #E5E5E5;
    --font: 'Inter', sans-serif;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: none; }
body {
    margin: 0; padding: 0; font-family: var(--font);
    background: var(--bg-color); color: var(--text-main);
    height: 100vh; overflow: hidden;
}

/* 页面架构 */
#app-root { position: relative; width: 100%; height: 100%; overflow: hidden; }
.page {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--bg-color); display: flex; flex-direction: column;
    transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    z-index: 1;
}
.page.active { transform: translateX(0); }
.page.right-sheet { z-index: 20; background: #fff; }

/* Header */
.main-header {
    height: 60px; padding: 0 24px; display: flex; justify-content: space-between; align-items: center;
    background: var(--bg-color);
}
.header-brand { font-weight: 800; font-size: 20px; letter-spacing: -0.5px; }
.header-actions { display: flex; gap: 16px; }
.icon-btn { background: none; border: none; cursor: pointer; color: var(--primary); padding: 0; }

/* Tab Content */
.tab-content { display: none; flex: 1; overflow-y: auto; padding: 20px 24px 80px 24px; }
.tab-content.active-tab { display: block; }
.list-title { font-size: 13px; font-weight: 600; color: var(--text-sub); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }

/* 列表样式 */
.k-list-item { display: flex; align-items: center; gap: 16px; padding: 12px 0; cursor: pointer; }
.avatar-circle { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; background: #eee; }
.item-content { flex: 1; }
.item-title { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
.item-subtitle { color: var(--text-sub); font-size: 14px; }
.divider { height: 1px; background: var(--border); margin: 10px 0 20px 0; }

/* --- 高级名片设计 (Premium Card) --- */
.premium-card-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.premium-card {
    width: 100%; max-width: 340px; height: 210px;
    background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
    border-radius: 16px; padding: 24px; color: #fff;
    position: relative; overflow: hidden;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
    display: flex; flex-direction: column; justify-content: space-between;
}
.card-top { display: flex; justify-content: space-between; align-items: center; }
.card-chip {
    width: 36px; height: 26px; background: linear-gradient(135deg, #e6cbaec4 0%, #d4af37 100%);
    border-radius: 4px; position: relative;
}
.card-brand { font-size: 12px; letter-spacing: 2px; font-weight: 600; opacity: 0.8; }
.card-body { display: flex; justify-content: space-between; align-items: flex-end; }
.card-info { display: flex; flex-direction: column; }
.card-label { font-size: 10px; color: #888; margin-bottom: 4px; letter-spacing: 1px; }
.card-value { font-family: monospace; font-size: 16px; letter-spacing: 1px; }
.card-qr {
    background: #fff; padding: 4px; border-radius: 4px;
    width: 70px; height: 70px; display: flex; justify-content: center; align-items: center;
}
.card-qr img { width: 100%; display: block; }
.card-footer { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.6; margin-top: 10px; }
.card-shine {
    position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
    background: linear-gradient(to bottom right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 100%);
    pointer-events: none; transform: rotate(30deg);
}
.card-hint { margin-top: 24px; color: var(--text-sub); font-size: 13px; letter-spacing: 1px; }

/* 底部导航 */
.bottom-nav {
    position: absolute; bottom: 0; width: 100%; height: 70px; background: rgba(255,255,255,0.9);
    backdrop-filter: blur(10px); border-top: 1px solid var(--border);
    display: flex; justify-content: center; gap: 40px; padding-bottom: env(safe-area-inset-bottom);
}
.nav-btn {
    border: none; background: none; font-weight: 600; font-size: 14px; color: var(--text-sub); cursor: pointer;
    position: relative;
}
.nav-btn.active { color: var(--primary); }
.nav-btn.active::after {
    content: ''; position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; background: var(--primary); border-radius: 50%;
}

/* 聊天窗口 */
.chat-header {
    height: 50px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; border-bottom: 1px solid var(--border); background: #fff;
}
.back-text { font-size: 16px; color: var(--primary); background: none; border: none; font-weight: 500; cursor: pointer; }
.chat-info { font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 6px; }
.dot { width: 6px; height: 6px; background: #4cd964; border-radius: 50%; opacity: 0; transition: opacity 0.3s; }
.dot.online { opacity: 1; }
.menu-btn { font-size: 20px; background: none; border: none; cursor: pointer; }

.messages-container { flex: 1; padding: 20px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }

/* 消息气泡 */
.msg-row { display: flex; flex-direction: column; max-width: 80%; }
.msg-row.self { align-self: flex-end; align-items: flex-end; }
.msg-row.other { align-self: flex-start; align-items: flex-start; }

.bubble {
    padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.5;
    background: #F2F2F7; color: #000; position: relative;
}
.msg-row.self .bubble { background: var(--primary); color: #fff; }

/* 贴纸样式 */
.sticker-img { width: 120px; height: 120px; object-fit: contain; }

/* 文件卡片与进度条 */
.file-card { width: 220px; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.file-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: #000; }
.file-icon { font-size: 24px; }
.progress-track { width: 100%; height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
.progress-bar { height: 100%; background: #007AFF; width: 0%; transition: width 0.1s; }
.file-meta { font-size: 10px; color: #888; display: flex; justify-content: space-between; }
.preview-img { width: 100%; border-radius: 8px; margin-top: 5px; display: block; }

/* 底部输入区 */
.chat-footer {
    padding: 10px 16px; background: #fff; border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px; padding-bottom: max(10px, env(safe-area-inset-bottom));
}
.input-box { flex: 1; background: #F2F2F7; border-radius: 20px; padding: 8px 12px; }
#chat-input { width: 100%; background: transparent; border: none; font-size: 15px; }
.footer-btn { font-size: 24px; background: none; border: none; color: #888; cursor: pointer; padding: 0; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; border: none; font-weight: bold; cursor: pointer; }

/* 表情面板 */
.sticker-panel { height: 200px; background: #fff; overflow-y: auto; border-top: 1px solid var(--border); padding: 10px; transition: height 0.3s; }
.sticker-panel.hidden { height: 0; padding: 0; border: none; }
.sticker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.sticker-item { width: 100%; cursor: pointer; transition: transform 0.1s; }
.sticker-item:active { transform: scale(0.9); }

/* 拖拽遮罩 */
.drag-overlay {
    position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.6);
    z-index: 50; display: flex; justify-content: center; align-items: center; pointer-events: none;
}
.drag-overlay.active { pointer-events: auto; } /* 只有在 active 时才响应 */
.drag-overlay.hidden { display: none; }
.drag-box { width: 200px; height: 200px; border: 2px dashed #fff; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; gap: 10px; }

/* Persistent Toast Notification */
.notify-card {
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    width: 90%; max-width: 400px; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
    border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    padding: 16px; display: flex; flex-direction: column; gap: 10px; z-index: 999;
    border: 1px solid rgba(0,0,0,0.05); animation: slideDown 0.3s ease-out;
}
@keyframes slideDown { from { top: -100px; } to { top: 20px; } }
.notify-card.hidden { display: none; }
.notify-title { font-weight: 700; font-size: 14px; color: var(--primary); }
.notify-body { font-size: 13px; color: var(--text-sub); }
.notify-actions { display: flex; gap: 10px; justify-content: flex-end; }
.notify-btn { border: none; background: none; font-size: 13px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; }
.notify-btn.close { color: #888; background: #f2f2f2; }
.notify-btn.view { color: #fff; background: var(--primary); }

/* Modal */
.modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); z-index: 100; display:flex; justify-content:center; align-items:center; }
.modal-overlay.hidden { display: none; }
.modal-box { background: #fff; padding: 24px; border-radius: 16px; width: 300px; }
.scanner-box { padding: 0; background: #000; overflow: hidden; position: relative; }
.close-float { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.3); border: none; width: 30px; height: 30px; border-radius: 50%; color: #fff; font-size: 20px; z-index: 10; cursor: pointer; }
.modal-input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid var(--border); border-radius: 8px; }
.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.btn-primary { background: var(--primary); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-text { background: none; border: none; color: #888; cursor: pointer; }
