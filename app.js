// --- 1. 动森 ID 系统 ---
let myId = localStorage.getItem('sloth_drop_id_v2');
if (!myId) {
    // 生成更短的随机ID，方便输入
    myId = 'SL-' + Math.floor(100000 + Math.random() * 900000);
    localStorage.setItem('sloth_drop_id_v2', myId);
}

// 随机头像 (Bottts 改为更可爱的风格)
const getAvatar = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=ffe0a5`;

document.getElementById('my-avatar').src = getAvatar(myId);
document.getElementById('my-avatar-small').src = getAvatar(myId);
document.getElementById('my-id-text').innerText = myId;

// 生成二维码 (无边框，更融入设计)
new QRCode(document.getElementById("qrcode"), {
    text: myId, width: 150, height: 150, colorDark : "#5A4D41", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.M
});

// --- 2. PeerJS 联网 (保持原逻辑，适配新UI) ---
const statusPill = document.getElementById('connection-status');
let peer = null;
let connections = {};
let activeChatId = null; 

function initNetwork() {
    statusPill.innerText = '连接中...';
    peer = new Peer(myId); // 使用默认 PeerServer

    peer.on('open', (id) => {
        statusPill.innerText = '在线';
        statusPill.classList.add('online');
        reconnectFriends();
    });

    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        console.log(err);
        statusPill.innerText = '离线';
        statusPill.classList.remove('online');
    });
}

function setupConnection(conn) {
    conn.on('open', () => {
        connections[conn.peer] = conn;
        addFriendToList(conn.peer); // 自动加好友
        updateChatStatus(conn.peer, true);
    });

    conn.on('data', (data) => handleIncomingData(conn.peer, data));
    conn.on('close', () => {
        delete connections[conn.peer];
        updateChatStatus(conn.peer, false);
    });
}

function connectTo(id) {
    if(!id || id === myId) return;
    if(connections[id] && connections[id].open) return;
    const conn = peer.connect(id);
    setupConnection(conn);
}

// --- 3. 扫码与摄像头逻辑 (新功能) ---
const qrOverlay = document.getElementById('qr-overlay');
const scanBtn = document.getElementById('scan-btn');
const closeCamBtn = document.getElementById('close-camera');
let html5QrCode;

scanBtn.addEventListener('click', () => {
    qrOverlay.classList.remove('hidden');
    startCamera();
});

closeCamBtn.addEventListener('click', () => {
    stopCamera();
    qrOverlay.classList.add('hidden');
});

function startCamera() {
    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 200, height: 200 } };
    
    // 优先使用后置摄像头
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        alert("无法启动摄像头，请检查权限");
        qrOverlay.classList.add('hidden');
    });
}

function stopCamera() {
    if(html5QrCode) {
        html5QrCode.stop().then(() => html5QrCode.clear());
    }
}

function onScanSuccess(decodedText, decodedResult) {
    // 扫码成功！
    stopCamera();
    qrOverlay.classList.add('hidden');
    
    // 震动反馈 (如果支持)
    if(navigator.vibrate) navigator.vibrate(200);

    // 自动连接
    document.getElementById('target-id-input').value = decodedText;
    connectTo(decodedText);
    showToast(`识别成功: ${decodedText}, 正在连接...`);
    
    // 稍微延迟跳转
    setTimeout(() => switchView('view-friends'), 1000);
}

// --- 4. 好友列表渲染 (Kakao 风格) ---
let friends = JSON.parse(localStorage.getItem('sloth_friends_v2')) || [];

function renderFriends() {
    const list = document.getElementById('friends-list');
    document.getElementById('friend-count').innerText = friends.length;
    list.innerHTML = '';
    
    friends.forEach(f => {
        const isOnline = connections[f.id] && connections[f.id].open;
        const div = document.createElement('div');
        div.className = 'kakao-item';
        div.innerHTML = `
            <img src="${getAvatar(f.id)}" class="avatar-kakao">
            <div class="info">
                <div class="name">${f.id}</div>
                <div class="status-msg">${isOnline ? '🟢 在线' : '⚪ 离线'}</div>
            </div>
        `;
        div.addEventListener('click', () => openChat(f.id));
        list.appendChild(div);
    });
}

function addFriendToList(id) {
    if (friends.find(f => f.id === id)) return;
    friends.push({ id: id, addedAt: Date.now() });
    localStorage.setItem('sloth_friends_v2', JSON.stringify(friends));
    renderFriends();
}

// --- 5. 聊天与消息 ---
const messagesArea = document.getElementById('messages-area');
const notificationSound = document.getElementById('notification-sound');

function handleIncomingData(senderId, data) {
    // 播放提示音
    notificationSound.play().catch(()=>{});
    showToast(`收到 ${senderId} 的消息`);

    if (activeChatId === senderId) {
        if (data.type === 'text') appendMessage('text', data.content, false);
        else if (data.type === 'file') {
            const blob = new Blob([data.file], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            appendMessage('file', { name: data.fileName, url: url }, false);
        }
    }
}

function openChat(id) {
    activeChatId = id;
    document.getElementById('chat-partner-name').innerText = id;
    messagesArea.innerHTML = '';
    switchView('view-chat');
    
    const isOnline = connections[id] && connections[id].open;
    updateChatStatus(id, isOnline);
    if(!isOnline) connectTo(id);
}

function updateChatStatus(id, isOnline) {
    if(activeChatId !== id) return;
    const dot = document.getElementById('chat-status-dot');
    dot.className = isOnline ? 'status-dot online' : 'status-dot';
}

function appendMessage(type, content, isSelf) {
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : 'other'}`;
    let html = '';
    if(type === 'text') html = `<div class="msg-bubble">${content}</div>`;
    else html = `<div class="msg-bubble"><a href="${content.url}" download="${content.name}" style="color:inherit">📂 ${content.name}</a></div>`;
    div.innerHTML = html;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// 发送逻辑
document.getElementById('send-btn').addEventListener('click', () => {
    const input = document.getElementById('msg-input');
    const val = input.value.trim();
    if(val && activeChatId && connections[activeChatId]) {
        connections[activeChatId].send({type:'text', content:val});
        appendMessage('text', val, true);
        input.value = '';
    }
});

document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file && activeChatId && connections[activeChatId]) {
        connections[activeChatId].send({type:'file', file:file, fileName:file.name, fileType:file.type});
        appendMessage('file', {name: file.name, url: '#'}, true);
    }
});
document.getElementById('folder-btn').addEventListener('click', () => document.getElementById('file-input').click());

// --- 6. 辅助功能 ---
function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(t => {
        t.classList.toggle('active', t.dataset.target === id);
    });
    
    // 聊天时不显示底部Tab
    document.getElementById('main-nav').style.display = (id === 'view-chat') ? 'none' : 'flex';
}
document.querySelectorAll('.tab-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.target)));
document.getElementById('back-btn').addEventListener('click', () => switchView('view-friends'));
document.getElementById('add-friend-btn').addEventListener('click', () => {
    const id = document.getElementById('target-id-input').value;
    if(id) { connectTo(id); switchView('view-friends'); }
});

function showToast(msg) {
    const t = document.getElementById('incoming-alert');
    t.querySelector('span:last-child').innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

function reconnectFriends() {
    friends.forEach(f => connectTo(f.id));
    renderFriends();
}

// 启动
initNetwork();
renderFriends();

// PWA WakeLock
document.addEventListener('click', async () => {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch(e){}
}, { once: true });

// SW Register
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
