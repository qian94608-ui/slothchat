document.addEventListener('DOMContentLoaded', () => {

    // --- 全局工具：强制控制显示/隐藏 ---
    // 修复：同时操作 class 和 style，确保覆盖之前的 display:none
    const showModal = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('hidden');
            el.style.display = 'flex'; // 强制覆盖内联样式
        }
    };

    const hideModal = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none'; // 强制隐藏
        }
    };

    const hideAllModals = () => {
        hideModal('qr-overlay');
        hideModal('add-overlay');
        hideModal('sticker-panel');
        // 停止并清理扫描器
        if (window.scannerObj) {
            window.scannerObj.stop().then(() => {
                window.scannerObj.clear();
            }).catch(err => console.log("Stop failed", err));
        }
    };
    // 挂载到 window 供 HTML onclick 调用
    window.hideAllModals = hideAllModals;


    // --- 1. 摄像头/扫码逻辑 (修复版) ---
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.onclick = () => {
            showModal('qr-overlay');

            // 关键修复：必须等弹窗完全显示出来，有了高度，才能启动摄像头
            setTimeout(() => {
                const qrContainer = document.getElementById("qr-reader");
                if (!qrContainer) return;

                // 如果已经有实例在运行，先清理
                if (window.scannerObj) {
                    try { window.scannerObj.clear(); } catch (e) {}
                }

                const scanner = new Html5Qrcode("qr-reader");
                window.scannerObj = scanner;

                scanner.start(
                    { facingMode: "environment" }, // 优先后置摄像头
                    { fps: 10, qrbox: { width: 200, height: 200 } },
                    (decodedText) => {
                        // 成功回调
                        hideAllModals();
                        // 震动
                        if (navigator.vibrate) navigator.vibrate(200);
                        alert(`>> FREN FOUND: ${decodedText}`);
                        addFriend(decodedText);
                        connectTo(decodedText);
                        openChat(decodedText);
                    },
                    (errorMessage) => {
                        // 扫描过程中的错误忽略，防止刷屏
                    }
                ).catch(err => {
                    console.error(err);
                    alert("Wojak Error: Camera refused to open.\nCheck browser permissions.");
                    hideAllModals();
                });
            }, 300); // 300ms 延迟确保 DOM 渲染
        };
    }


    // --- 2. 手动添加好友逻辑 (修复版) ---
    const addIdBtn = document.getElementById('add-id-btn');
    if (addIdBtn) {
        addIdBtn.onclick = () => {
            showModal('add-overlay');
            // 自动聚焦输入框
            setTimeout(() => document.getElementById('manual-id-input').focus(), 100);
        };
    }

    const confirmAddBtn = document.getElementById('confirm-add-btn');
    if (confirmAddBtn) {
        confirmAddBtn.onclick = () => {
            const input = document.getElementById('manual-id-input');
            const id = input.value.trim();
            
            if (!id) {
                alert("Type something...");
                return;
            }

            // 执行添加
            addFriend(id);
            connectTo(id);
            hideAllModals();
            input.value = ''; // 清空
            
            // 立即反馈
            alert(`>> ADDED FREN: ${id}`);
            openChat(id);
        };
    }


    // --- 3. 基础 UI 导航 (Tab切换) ---
    const tabBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-tab'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        };
    });

    // 聊天返回
    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('view-chat').classList.remove('active');
            activeChatId = null;
        };
    }

    // 表情面板开关
    const stickerBtn = document.getElementById('sticker-btn');
    if (stickerBtn) {
        stickerBtn.onclick = () => {
            const panel = document.getElementById('sticker-panel');
            if (panel.style.display === 'none' || panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                panel.style.display = 'block';
            } else {
                panel.classList.add('hidden');
                panel.style.display = 'none';
            }
        };
    }


    // --- 4. 业务数据与网络 (ID, PeerJS) ---
    const MY_ID = localStorage.getItem('wojak_id') || 'Anon-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('wojak_id', MY_ID);
    
    let friends = JSON.parse(localStorage.getItem('wojak_frens')) || [];
    let activeChatId = null;
    let connections = {};
    let peer = null;

    // 随机生成怪异头像
    const getAvatar = (seed) => `https://api.dicebear.com/7.x/micah/svg?seed=${seed}&baseColor=f9c9b6&hairColor=000000,363636&mouth=pucker,smile,smirk&eyes=eyes,round,smiling`;

    // 初始化渲染
    try {
        document.getElementById('my-id-display').innerText = `ID: ${MY_ID}`;
        document.getElementById('card-id-text').innerText = MY_ID;
        document.getElementById('my-avatar-small').src = getAvatar(MY_ID);
        // 生成二维码
        if(window.QRCode) {
            document.getElementById("qrcode").innerHTML = ""; // 清空防止重复
            new QRCode(document.getElementById("qrcode"), { 
                text: MY_ID, width: 80, height: 80, colorDark: "#000000", colorLight: "#ffffff" 
            });
        }
    } catch (e) { console.error("Init UI Error", e); }

    renderFriends();

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        
        friends.forEach(id => {
            const isOnline = connections[id] && connections[id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="${getAvatar(id)}" class="avatar-img"></div>
                <div class="item-content">
                    <div class="item-title">${id}</div>
                    <div class="status-text" style="color:${isOnline ? 'green' : 'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;
            div.onclick = () => openChat(id);
            list.appendChild(div);
        });
    }

    function addFriend(id) {
        if (!friends.includes(id)) {
            friends.push(id);
            localStorage.setItem('wojak_frens', JSON.stringify(friends));
            renderFriends();
        }
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('messages-container').innerHTML = ''; // 清空（演示用）

        // 更新状态点
        const isOnline = connections[id] && connections[id].open;
        const dot = document.getElementById('chat-status-dot');
        if(dot) dot.className = isOnline ? 'status-square online' : 'status-square';
    }

    // --- 消息处理 ---
    const msgContainer = document.getElementById('messages-container');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const sound = document.getElementById('msg-sound');

    function sendText() {
        const txt = chatInput.value.trim();
        if (txt && activeChatId) {
            if (connections[activeChatId]) {
                connections[activeChatId].send({ type: 'text', content: txt });
            } else {
                // 可以在这里提示“对方不在线”
            }
            appendMsg(txt, true);
            chatInput.value = '';
        }
    }

    if(sendBtn) sendBtn.onclick = sendText;
    if(chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendText(); };

    function appendMsg(txt, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf ? 'self' : 'other'}`;
        div.innerHTML = `<div class="bubble">${txt}</div>`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function handleData(id, data) {
        if (activeChatId !== id) {
            if(sound) sound.play().catch(() => {});
            return;
        }
        if (data.type === 'text') appendMsg(data.content, false);
        else if (data.type === 'sticker') appendSticker(data.url, false);
    }

    // --- Wojak Sticker 生成 ---
    const wojakStickers = [
        'https://i.imgur.com/9Y9w4fU.png', 'https://i.imgur.com/8QQzY7d.png',
        'https://i.imgur.com/tXX9X9Y.png', 'https://i.imgur.com/0QQzY7d.png',
        'https://i.imgur.com/5QQzY7d.png', 'https://i.imgur.com/3QQzY7d.png'
    ];
    const stickerGrid = document.getElementById('sticker-grid');
    if(stickerGrid) {
        wojakStickers.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'sticker-item sticker-img';
            img.onclick = () => {
                if (activeChatId && connections[activeChatId]) {
                    connections[activeChatId].send({ type: 'sticker', url: url });
                    appendSticker(url, true);
                    document.getElementById('sticker-panel').style.display = 'none';
                }
            };
            stickerGrid.appendChild(img);
        });
    }

    function appendSticker(url, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf ? 'self' : 'other'}`;
        div.innerHTML = `<img src="${url}" class="sticker-img">`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // --- PeerJS 网络 ---
    try {
        if(window.Peer) {
            peer = new Peer(MY_ID);
            peer.on('open', () => {
                console.log('Connected to PeerServer');
                friends.forEach(connectTo);
            });
            peer.on('connection', setupConn);
            peer.on('error', err => console.log('Peer Error', err));
        } else {
            console.error("PeerJS not loaded");
        }
    } catch (e) { console.log('Network Init Error', e); }

    function connectTo(id) {
        if (id === MY_ID) return;
        const conn = peer.connect(id);
        setupConn(conn);
    }

    function setupConn(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            addFriend(conn.peer); // 自动加好友
            renderFriends(); // 刷新状态
        });
        conn.on('data', d => handleData(conn.peer, d));
        conn.on('close', () => {
            // 连接断开处理
            renderFriends();
        });
    }

    // 全局点击解锁音频
    document.body.onclick = () => { if(sound) sound.load(); };
});