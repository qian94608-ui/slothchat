// --- 1. 基础 UI 绑定 (立即执行，保证可点击) ---

// 导航切换
const tabBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.onclick = () => {
        // 移除所有 active 状态
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active-tab'));
        // 添加当前 active
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-tab');
    };
});

// 全局辅助函数：操作样式而非 class，确保兼容性
window.showEl = (id) => { 
    const el = document.getElementById(id); 
    el.classList.remove('hidden'); 
    el.style.display = 'flex'; // 强制显示
};
window.hideEl = (id) => { 
    const el = document.getElementById(id); 
    el.classList.add('hidden'); 
    el.style.display = 'none'; // 强制隐藏
};

window.hideAllModals = () => {
    hideEl('qr-overlay');
    hideEl('add-overlay');
    if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
};

// 按钮点击事件
document.getElementById('scan-btn').onclick = () => {
    showEl('qr-overlay');
    try {
        const scanner = new Html5Qrcode("qr-reader");
        window.scannerObj = scanner;
        scanner.start({facingMode:"environment"}, {fps:10}, (txt)=>{
            hideAllModals();
            addFriend(txt);
            connectTo(txt);
            openChat(txt);
        });
    } catch(e) { alert('相机启动失败'); }
};

document.getElementById('add-id-btn').onclick = () => showEl('add-overlay');
document.getElementById('confirm-add-btn').onclick = () => {
    const id = document.getElementById('manual-id-input').value.trim();
    if(id) { addFriend(id); connectTo(id); hideAllModals(); openChat(id); }
};

document.getElementById('chat-back-btn').onclick = () => {
    document.getElementById('view-chat').classList.remove('active');
    activeChatId = null;
};

// 表情面板开关
document.getElementById('sticker-btn').onclick = () => {
    const panel = document.getElementById('sticker-panel');
    if(panel.style.display === 'none') {
        panel.classList.remove('hidden');
        panel.style.display = 'block';
    } else {
        panel.classList.add('hidden');
        panel.style.display = 'none';
    }
};

// --- 2. 逻辑与网络部分 ---

const MY_ID = localStorage.getItem('sloth_v4_id') || 'U-' + Math.floor(Math.random()*99999);
localStorage.setItem('sloth_v4_id', MY_ID);
let friends = JSON.parse(localStorage.getItem('sloth_v4_friends')) || [];
let activeChatId = null;
let connections = {};
let peer = null;

// 初始化渲染
try {
    document.getElementById('my-id-display').innerText = `ID: ${MY_ID}`;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar-small').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${MY_ID}&backgroundColor=e5e5e5`;
    new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60 });
} catch(e){}

renderFriends();

function renderFriends() {
    const list = document.getElementById('friends-list-container');
    list.innerHTML = '';
    friends.forEach(id => {
        const div = document.createElement('div');
        div.className = 'k-list-item';
        div.innerHTML = `
            <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${id}&backgroundColor=e5e5e5" class="avatar-circle">
            <div class="item-content"><div class="item-title">${id}</div><div class="item-subtitle">点击聊天</div></div>
        `;
        div.onclick = () => openChat(id);
        list.appendChild(div);
    });
}

function addFriend(id) {
    if(!friends.includes(id)) {
        friends.push(id);
        localStorage.setItem('sloth_v4_friends', JSON.stringify(friends));
        renderFriends();
    }
}

function openChat(id) {
    activeChatId = id;
    document.getElementById('chat-partner-name').innerText = id;
    document.getElementById('view-chat').classList.add('active');
    document.getElementById('messages-container').innerHTML = '';
}

// 消息发送逻辑
const msgContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');

document.getElementById('chat-send-btn').onclick = sendText;
chatInput.onkeypress = (e) => { if(e.key==='Enter') sendText(); };

function sendText() {
    const txt = chatInput.value.trim();
    if(txt && activeChatId) {
        if(connections[activeChatId]) connections[activeChatId].send({type:'text', content:txt});
        appendMsg(txt, true);
        chatInput.value = '';
    }
}

function appendMsg(txt, isSelf) {
    const div = document.createElement('div');
    div.className = `msg-row ${isSelf?'self':'other'}`;
    div.innerHTML = `<div class="bubble">${txt}</div>`;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

// 文件发送
const fileInput = document.getElementById('real-file-input');
document.getElementById('add-file-btn').onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    if(e.target.files[0] && activeChatId && connections[activeChatId]) {
        sendFile(connections[activeChatId], e.target.files[0]);
    }
};

// 简单文件切片发送
function sendFile(conn, file) {
    const transferId = Date.now();
    const msgId = appendFileMsg({name:file.name, id:transferId, size:file.size}, true);
    
    // 简易处理：直接发 blob (PeerJS 会自动处理，这里为了稳定性不手动切片了)
    conn.send({ type: 'file-blob', file: file, name: file.name, id: transferId, size: file.size, fileType: file.type });
    updateProgress(transferId, 100);
    if(file.type.startsWith('image/')) showPreview(msgId, URL.createObjectURL(file));
}

function handleData(id, data) {
    if(activeChatId !== id) {
        showNotify(id, data.type === 'text' ? data.content : '[文件]');
        return;
    }
    
    if(data.type === 'text') appendMsg(data.content, false);
    else if(data.type === 'file-blob') {
        const msgId = appendFileMsg(data, false);
        const blob = new Blob([data.file], {type: data.fileType});
        updateProgress(data.id, 100);
        finishFile(msgId, blob, data.name);
    }
    else if(data.type === 'sticker') appendSticker(data.url, false);
}

function appendFileMsg(info, isSelf) {
    const div = document.createElement('div');
    div.id = 'msg-'+info.id;
    div.className = `msg-row ${isSelf?'self':'other'}`;
    div.innerHTML = `
        <div class="file-card">
            <div>📄 ${info.name}</div>
            <div class="progress-track"><div class="progress-bar" id="p-${info.id}" style="width:0%"></div></div>
            <div id="pv-${info.id}"></div>
        </div>`;
    msgContainer.appendChild(div);
    return 'msg-'+info.id;
}
function updateProgress(id, pct) { 
    const el = document.getElementById(`p-${id}`);
    if(el) el.style.width = pct+'%'; 
}
function finishFile(msgId, blob, name) {
    const el = document.getElementById(msgId).querySelector('[id^="pv-"]');
    const url = URL.createObjectURL(blob);
    if(blob.type.startsWith('image/')) el.innerHTML = `<img src="${url}" style="width:100%;border-radius:5px;margin-top:5px">`;
    else el.innerHTML = `<a href="${url}" download="${name}" style="color:blue;display:block;margin-top:5px">保存文件</a>`;
}

// 表情包生成
const seeds = ['happy','cool','wink','love','cry','angry'];
const stickerGrid = document.getElementById('sticker-grid');
seeds.forEach(s => {
    const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
    const img = document.createElement('img');
    img.src = url;
    img.className = 'sticker-img';
    img.onclick = () => {
        if(activeChatId && connections[activeChatId]) {
            connections[activeChatId].send({type:'sticker', url:url});
            appendSticker(url, true);
            hideEl('sticker-panel');
        }
    };
    stickerGrid.appendChild(img);
});
function appendSticker(url, isSelf) {
    const div = document.createElement('div');
    div.className = `msg-row ${isSelf?'self':'other'}`;
    div.innerHTML = `<img src="${url}" style="width:100px;">`;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

// 通知逻辑
window.hideNotify = () => hideEl('persistent-toast');
function showNotify(id, txt) {
    const t = document.getElementById('persistent-toast');
    document.getElementById('notify-text').innerText = `${id}: ${txt}`;
    showEl('persistent-toast');
    document.getElementById('msg-sound').play().catch(()=>{});
    document.getElementById('notify-view').onclick = () => {
        hideNotify(); openChat(id);
    };
}

// PeerJS 启动
try {
    peer = new Peer(MY_ID);
    peer.on('open', () => friends.forEach(connectTo));
    peer.on('connection', conn => {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            addFriend(conn.peer);
        });
        conn.on('data', d => handleData(conn.peer, d));
    });
} catch(e){ console.log('Network Error'); }

function connectTo(id) {
    if(id === MY_ID) return;
    const conn = peer.connect(id);
    conn.on('open', () => {
        connections[conn.peer] = conn;
        addFriend(conn.peer);
    });
    conn.on('data', d => handleData(conn.peer, d));
}

// 全局点击解锁音频
document.body.onclick = () => document.getElementById('msg-sound').load();
