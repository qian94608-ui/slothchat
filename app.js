// --- 1. 配置与初始化 ---
let myId = localStorage.getItem('sloth_drop_id');
if (!myId) {
    // 生成随机ID (sloth-xxxx)
    myId = 'sloth-' + Math.random().toString(36).substr(2, 4);
    localStorage.setItem('sloth_drop_id', myId);
}

// 头像生成
const getAvatar = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=2ecc71`;
document.getElementById('my-avatar').src = getAvatar(myId);
document.getElementById('my-id-text').innerText = myId;

// 生成二维码
new QRCode(document.getElementById("qrcode"), {
    text: myId, width: 128, height: 128, colorDark : "#27ae60", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
});

// --- 2. PeerJS 网络核心 (真实P2P) ---
const statusBadge = document.getElementById('connection-status');
let peer = null;
let connections = {}; // 存储活跃连接
let activeChatId = null; 

function initNetwork() {
    statusBadge.innerText = '连接服务器...';
    // 连接到公共信令服务器
    peer = new Peer(myId, { debug: 1 });

    peer.on('open', (id) => {
        statusBadge.innerText = '在线';
        statusBadge.classList.add('connected');
        reconnectFriends(); // 上线后尝试重连好友
    });

    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer Error:', err);
        statusBadge.innerText = '连接中断';
        statusBadge.classList.remove('connected');
        statusBadge.classList.add('error');
    });
}

function setupConnection(conn) {
    conn.on('open', () => {
        connections[conn.peer] = conn;
        // 如果此人不在好友列表，自动添加
        addFriendToList(conn.peer);
        updateChatStatus(conn.peer, true);
    });

    conn.on('data', (data) => {
        handleIncomingData(conn.peer, data);
    });

    conn.on('close', () => {
        delete connections[conn.peer];
        updateChatStatus(conn.peer, false);
    });
}

// 主动连接
function connectTo(id) {
    if(!id || id === myId) return;
    if(connections[id] && connections[id].open) return;
    const conn = peer.connect(id);
    setupConnection(conn);
}

// --- 3. 消息处理 ---
const messagesArea = document.getElementById('messages-area');
const notificationSound = document.getElementById('notification-sound');
const alertBox = document.getElementById('incoming-alert');

function handleIncomingData(senderId, data) {
    // 提醒特效
    notificationSound.play().catch(()=>{}); 
    alertBox.classList.remove('hidden');
    setTimeout(() => alertBox.classList.add('hidden'), 4000);

    // 如果正在聊天，直接显示
    if (activeChatId === senderId) {
        if (data.type === 'text') {
            appendMessage('text', data.content, false);
        } else if (data.type === 'file') {
            // 接收文件 blob
            const blob = new Blob([data.file], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            appendMessage('file', { name: data.fileName, url: url }, false);
        }
    }
}

// 发送消息
function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !activeChatId) return;

    const conn = connections[activeChatId];
    if (conn && conn.open) {
        conn.send({ type: 'text', content: text });
        appendMessage('text', text, true);
        input.value = '';
    } else {
        alert('对方不在线 (请让对方打开网页)');
    }
}

// 发送文件
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !activeChatId) return;
    
    const conn = connections[activeChatId];
    if (conn && conn.open) {
        appendMessage('file', { name: file.name, isSending: true }, true);
        conn.send({
            type: 'file', file: file, fileName: file.name, fileType: file.type
        });
    } else {
        alert('未连接');
    }
    e.target.value = ''; // 重置
});

// UI: 渲染消息
function appendMessage(type, content, isSelf) {
    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : 'other'}`;
    
    if (type === 'text') {
        div.innerHTML = `<div class="msg-bubble">${content}</div>`;
    } else if (type === 'file') {
        if (isSelf) {
            div.innerHTML = `<div class="msg-bubble file-card">📂 已发送: ${content.name}</div>`;
        } else {
            div.innerHTML = `
                <div class="msg-bubble file-card">
                    <a href="${content.url}" download="${content.name}">⬇️ 收到文件: ${content.name}</a>
                </div>`;
        }
    }
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// --- 4. 好友与 UI 逻辑 ---
let friends = JSON.parse(localStorage.getItem('sloth_friends')) || [];

function renderFriends() {
    const list = document.getElementById('friends-list');
    list.innerHTML = '';
    friends.forEach(f => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
            <img src="${getAvatar(f.id)}" class="small-avatar">
            <div class="friend-info">
                <div class="friend-name">ID: ${f.id}</div>
            </div>
            <div>💬</div>
        `;
        div.addEventListener('click', () => openChat(f.id));
        list.appendChild(div);
    });
}

function addFriendToList(id) {
    if (friends.find(f => f.id === id)) return;
    friends.push({ id: id });
    localStorage.setItem('sloth_friends', JSON.stringify(friends));
    renderFriends();
}

function openChat(id) {
    activeChatId = id;
    document.getElementById('chat-partner-name').innerText = id;
    document.getElementById('chat-partner-avatar').src = getAvatar(id);
    messagesArea.innerHTML = ''; // 清空当前屏
    
    // 切换视图
    switchView('view-chat');
    
    // 检查状态
    const isOnline = connections[id] && connections[id].open;
    updateChatStatus(id, isOnline);
    if(!isOnline) connectTo(id); // 尝试重连
}

function updateChatStatus(id, isOnline) {
    if (activeChatId !== id) return;
    const dot = document.getElementById('chat-status-dot');
    dot.className = isOnline ? 'dot-online' : 'dot-offline';
}

function reconnectFriends() {
    friends.forEach(f => connectTo(f.id));
}

// 视图切换
function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('main-nav').style.display = (id === 'view-chat') ? 'none' : 'flex';
}
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.target)));
document.getElementById('back-btn').addEventListener('click', () => switchView('view-friends'));
document.getElementById('add-friend-btn').addEventListener('click', () => {
    const id = document.getElementById('target-id-input').value.trim();
    if(id) { connectTo(id); switchView('view-friends'); }
});
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('msg-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

// PWA: WakeLock (防止手机锁屏断网)
document.addEventListener('click', async () => {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch(e){}
}, { once: true });

// 启动
initNetwork();
renderFriends();

// PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}