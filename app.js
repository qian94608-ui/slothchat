document.addEventListener('DOMContentLoaded', () => {

    // --- 配置 ---
    const PREFIX = 'wojak-v14-';
    const DB_KEY = 'wojak_v14_id';
    
    // TURN 服务器 (解决 4G 问题)
    const PEER_CONFIG = {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                // OpenRelay 免费 TURN (必须有这个才能穿透4G)
                { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
            ],
            sdpSemantics: 'unified-plan'
        }
    };

    // --- 状态 ---
    const App = {
        peer: null,
        conn: null,
        id: localStorage.getItem(DB_KEY),
        queue: [],
        isSending: false,
        chunkSize: 16 * 1024,
        maxBuffer: 64 * 1024
    };

    // 如果没有ID，生成一个4位随机数
    if (!App.id || App.id.length !== 4) {
        App.id = String(Math.floor(1000 + Math.random() * 9000));
        localStorage.setItem(DB_KEY, App.id);
    }

    const UI = {
        myId: document.getElementById('my-id'),
        status: document.getElementById('status-bar'),
        cardConnect: document.getElementById('card-connect'),
        cardTransfer: document.getElementById('card-transfer'),
        list: document.getElementById('transfer-list'),
        fab: document.getElementById('fab'),
        chatModal: document.getElementById('chat-modal'),
        chatMsgs: document.getElementById('chat-msgs'),
        chatBadge: document.getElementById('chat-badge'),
        dropZone: document.getElementById('drop-zone')
    };

    // --- 1. 初始化 ---
    function init() {
        // 使用带前缀的 ID
        App.peer = new Peer(PREFIX + App.id, PEER_CONFIG);
        
        App.peer.on('open', id => {
            console.log('My Peer ID:', id);
            UI.myId.innerText = App.id;
            UI.status.innerText = "ONLINE - WAITING";
            UI.status.classList.add('online');
            new QRCode(document.getElementById("qrcode"), { text: App.id, width: 90, height: 90 });
        });

        App.peer.on('connection', conn => {
            handleConnection(conn);
        });

        App.peer.on('error', err => {
            console.log(err);
            if(err.type === 'peer-unavailable') showToast("User Offline or ID Wrong");
            else if(err.type === 'disconnected') {
                UI.status.innerText = "DISCONNECTED";
                UI.status.classList.remove('online');
                setTimeout(() => App.peer.reconnect(), 2000);
            }
        });
    }
    init();

    // --- 2. 连接逻辑 ---
    window.manualConnect = () => {
        const inputId = document.getElementById('target-id').value.trim();
        if(inputId.length !== 4) return showToast("Need 4 Digit ID");
        
        showToast("Connecting...");
        const conn = App.peer.connect(PREFIX + inputId, { reliable: true });
        handleConnection(conn);
    };

    function handleConnection(conn) {
        // 任何一方连接成功，都视为建立通道
        App.conn = conn;
        const remoteShortId = conn.peer.replace(PREFIX, '');

        conn.on('open', () => {
            showToast("CONNECTED!");
            UI.status.innerText = "LINKED WITH " + remoteShortId;
            
            // 切换界面
            UI.cardConnect.style.display = 'none';
            UI.cardTransfer.style.display = 'block';
            UI.fab.style.display = 'flex';
            
            // 发送一条握手消息（可选）
            conn.send({ type: 'sys', text: 'Handshake OK' });
        });

        conn.on('close', () => {
            showToast("DISCONNECTED");
            setTimeout(() => location.reload(), 1000);
        });

        conn.on('data', data => onDataReceived(data));
        
        conn.on('error', err => console.log("Conn Error", err));
    }

    // --- 3. 传输引擎 (来自 MochiDrop) ---
    let rxState = { buffer: [], received: 0, meta: null, id: null, start: 0, lastUpdate: 0 };

    function onDataReceived(data) {
        // A. 文件块
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            if (!rxState.meta) return;
            const chunk = new Uint8Array(data);
            rxState.buffer.push(chunk);
            rxState.received += chunk.byteLength;

            const now = Date.now();
            if (now - rxState.lastUpdate > 200 || rxState.received === rxState.meta.size) {
                updateProgress(rxState.id, rxState.received, rxState.meta.size, rxState.start);
                rxState.lastUpdate = now;
            }
        }
        // B. 信令
        else if (data.type) {
            if (data.type === 'header') {
                rxState.buffer = []; rxState.received = 0; rxState.meta = data; 
                rxState.id = data.id; rxState.start = Date.now();
                createTransferItem(data.id, data.name, 'receiving', data.mode);
                App.conn.send({ type: 'ack', id: data.id }); // ACK
            }
            else if (data.type === 'ack') {
                if (App.pendingAckResolve) { App.pendingAckResolve(); App.pendingAckResolve = null; }
            }
            else if (data.type === 'end') {
                const blob = new Blob(rxState.buffer, { type: rxState.meta.mime });
                const url = URL.createObjectURL(blob);
                finishTransferItem(rxState.id, url, rxState.meta.name, rxState.meta.mime, 'in', rxState.meta.mode);
                rxState.buffer = []; rxState.meta = null;
            }
            else if (data.type === 'chat') {
                appendChatMsg(data.text, 'friend');
                if (!UI.chatModal.classList.contains('active')) {
                    UI.chatBadge.style.display = 'block';
                    showToast("New Message");
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
            }
        }
    }

    // --- 发送队列 ---
    window.enqueueFiles = (files, mode) => {
        for (let f of files) {
            const id = Date.now() + Math.random().toString(16).slice(2);
            createTransferItem(id, f.name, 'sending', mode);
            App.queue.push({ file: f, id: id, mode: mode });
        }
        processQueue();
    };

    async function processQueue() {
        if (App.isSending || App.queue.length === 0) return;
        App.isSending = true;
        const job = App.queue.shift();

        // 1. Header
        App.conn.send({ 
            type: 'header', name: job.file.name, size: job.file.size, 
            mime: job.file.type, id: job.id, mode: job.mode 
        });

        // 2. Wait ACK
        try {
            await new Promise((resolve, reject) => {
                App.pendingAckResolve = resolve;
                setTimeout(() => reject("Timeout"), 5000);
            });
        } catch (e) {
            showToast("Transfer Timeout");
            App.isSending = false; processQueue(); return;
        }

        // 3. Chunks
        let offset = 0;
        const start = Date.now();
        let lastUpdate = 0;
        while (offset < job.file.size) {
            if (App.conn.dataChannel.bufferedAmount > App.maxBuffer) {
                await new Promise(r => setTimeout(r, 20)); continue;
            }
            const chunk = job.file.slice(offset, offset + App.chunkSize);
            const buffer = await chunk.arrayBuffer();
            App.conn.send(new Uint8Array(buffer));
            offset += App.chunkSize;
            
            const now = Date.now();
            if (now - lastUpdate > 200 || offset >= job.file.size) {
                updateProgress(job.id, offset, job.file.size, start);
                lastUpdate = now;
            }
        }

        // 4. End
        App.conn.send({ type: 'end' });
        const url = URL.createObjectURL(job.file);
        finishTransferItem(job.id, url, job.file.name, job.file.type, 'out', job.mode);
        
        App.isSending = false;
        processQueue();
    }

    // --- UI 渲染 ---
    function createTransferItem(id, name, type, mode) {
        if (mode === 'main') {
            const li = document.createElement('li');
            li.className = 'transfer-item'; li.id = `item-${id}`;
            li.innerHTML = `
                <div style="font-size:1.5rem">${type==='sending'?'📤':'📥'}</div>
                <div class="t-info">
                    <div class="t-name">${name}</div>
                    <div class="t-meta"><span class="state">0%</span></div>
                    <div class="t-bar"><div class="t-fill" style="width:0%"></div></div>
                </div>
                <div class="actions"></div>`;
            UI.list.prepend(li);
        } else {
            const div = document.createElement('div');
            div.className = `msg ${type === 'sending' ? 'self' : 'friend'}`;
            div.id = `bubble-${id}`;
            div.innerHTML = `<div>📄 ${name}</div><div class="t-bar"><div class="t-fill" style="width:0%"></div></div>`;
            UI.chatMsgs.appendChild(div);
            UI.chatMsgs.scrollTop = UI.chatMsgs.scrollHeight;
        }
    }

    function updateProgress(id, loaded, total, startTime) {
        const pct = Math.floor((loaded / total) * 100);
        // 更新主列表
        const mainItem = document.getElementById(`item-${id}`);
        if (mainItem) {
            mainItem.querySelector('.t-fill').style.width = pct + "%";
            mainItem.querySelector('.state').innerText = pct + "%";
        }
        // 更新聊天
        const bubble = document.getElementById(`bubble-${id}`);
        if (bubble) bubble.querySelector('.t-fill').style.width = pct + "%";
    }

    function finishTransferItem(id, url, name, mime, dir, mode) {
        const isImg = mime.startsWith('image/');
        const mainItem = document.getElementById(`item-${id}`);
        
        // 主列表完成态
        if (mainItem) {
            mainItem.querySelector('.t-bar').style.display = 'none';
            mainItem.querySelector('.state').innerText = "DONE";
            if (dir === 'in') {
                const a = document.createElement('a'); a.href = url; a.download = name; a.innerText = "📥";
                a.style.fontSize="1.5rem"; a.style.textDecoration="none";
                mainItem.querySelector('.actions').appendChild(a);
            }
        }

        // 聊天完成态
        const bubble = document.getElementById(`bubble-${id}`);
        if (bubble) {
            if (isImg) {
                bubble.innerHTML = `<img src="${url}" style="max-width:200px; border:2px solid #000; cursor:zoom-in;" onclick="document.getElementById('lb-img').src='${url}';document.getElementById('lightbox').style.display='flex'">`;
            } else {
                if(dir === 'in') bubble.innerHTML = `<a href="${url}" download="${name}" style="color:blue; font-weight:bold;">📥 DOWNLOAD: ${name}</a>`;
                else bubble.innerHTML = `✅ SENT: ${name}`;
            }
            UI.chatMsgs.scrollTop = UI.chatMsgs.scrollHeight;
        }
    }

    // --- 交互 ---
    window.showToast = (msg) => {
        const t = document.getElementById('toast');
        t.innerText = msg; t.style.display = 'block';
        setTimeout(()=>t.style.display='none', 3000);
    }

    // 扫码
    window.startScan = () => {
        document.getElementById('scanner-layer').style.display = 'flex';
        const scanner = new Html5Qrcode("reader");
        window.scanner = scanner;
        scanner.start({facingMode:"environment"}, {fps:10, qrbox:250}, (txt) => {
            document.getElementById('target-id').value = txt;
            window.stopScan();
            window.manualConnect();
        });
    }
    window.stopScan = () => {
        if(window.scanner) window.scanner.stop();
        document.getElementById('scanner-layer').style.display = 'none';
    }

    // 聊天
    window.openChat = () => { UI.chatModal.classList.add('active'); UI.chatBadge.style.display='none'; }
    window.closeChat = () => { UI.chatModal.classList.remove('active'); }
    
    window.sendText = () => {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if(!txt || !App.conn) return;
        App.conn.send({ type: 'chat', text: txt });
        appendChatMsg(txt, 'self');
        input.value = "";
    }
    
    function appendChatMsg(txt, who) {
        const div = document.createElement('div');
        div.className = `msg ${who}`; div.innerText = txt;
        UI.chatMsgs.appendChild(div);
        UI.chatMsgs.scrollTop = UI.chatMsgs.scrollHeight;
    }

    // 文件选择
    document.getElementById('file-input').onchange = (e) => enqueueFiles(e.target.files, 'main');
    document.getElementById('chat-file-input').onchange = (e) => enqueueFiles(e.target.files, 'chat');
    UI.dropZone.onclick = () => document.getElementById('file-input').click();

    // 表情
    const emojis = ["🤡","🐸","💀","😡","😭","🙏"];
    emojis.forEach(e => {
        const div = document.createElement('div'); div.className='emoji'; div.innerText=e;
        div.onclick = () => { document.getElementById('chat-input').value += e; };
        document.getElementById('emoji-panel').appendChild(div);
    });
    window.toggleEmoji = () => {
        const p = document.getElementById('emoji-panel');
        p.style.display = p.style.display==='grid'?'none':'grid';
    }
});
