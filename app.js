document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 强制样式 (Pepe 风格 + 修复层级) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { 
            --pepe-green: #59BC10; 
            --pepe-dark: #45960b; 
            --pepe-red: #E02424; 
            --bg-color: #F0F5F2;
        }
        body { background: var(--bg-color); font-family: 'Arial', sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 20px !important; }

        /* 头部修复 (让笔形图标可点击) */
        .defi-header { z-index: 100; position: relative; }
        .user-pill { 
            position: relative; z-index: 101; cursor: pointer; 
            background: #fff; border: 2px solid #eee; padding: 5px 15px; border-radius: 20px;
            display: flex; align-items: center; gap: 8px;
        }
        .edit-icon { color: #999; font-size: 16px; }

        /* 列表项 */
        .k-list-item { 
            background: #fff; border: 2px solid #fff; border-radius: 12px; 
            padding: 12px; margin-bottom: 10px; position: relative;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .k-list-item:active { transform: translateY(2px); border-color: var(--pepe-green); }

        /* 拨号盘 (修复握手按钮) */
        .numpad-container { padding: 10px; display: flex; flex-direction: column; align-items: center; }
        .id-display-screen { 
            font-size: 40px; color: var(--pepe-green); font-weight: 900; 
            border-bottom: 3px solid #eee; width: 80%; text-align: center; 
            margin-bottom: 20px; height: 50px; line-height: 50px;
        }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { 
            width: 65px; height: 65px; border-radius: 12px; background: #fff; 
            border: 2px solid #eee; box-shadow: 0 4px 0 #ddd; 
            font-size: 24px; font-weight: bold; color: #333; 
            display: flex; justify-content: center; align-items: center; 
            cursor: pointer; user-select: none;
        }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        /* 握手按钮特写 */
        .num-btn.connect { 
            background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); 
            box-shadow: 0 4px 0 var(--pepe-dark); font-size: 32px;
        }

        /* 聊天气泡 */
        .bubble { 
            border: none !important; border-radius: 12px !important; 
            padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); 
            max-width: 80%; font-size: 15px;
        }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee !important; }

        /* 媒体与文档 */
        .thumb-box { border-radius: 8px; overflow: hidden; display: inline-block; }
        .thumb-img { max-width: 180px; height: auto; display: block; }
        .doc-card { 
            display: flex; align-items: center; gap: 10px; 
            background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; 
            text-decoration: none; color: #333; border: 1px solid #eee;
        }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; }

        /* 底部栏 */
        .chat-footer { padding: 10px; background: #fff; border-top: 1px solid #eee; z-index: 200; }
        #chat-input { flex: 1; height: 42px; border: 2px solid #eee; border-radius: 21px; padding: 0 15px; outline: none; }
        .voice-btn-long { display: none; width: 100%; height: 42px; background: var(--pepe-red); color: white; border-radius: 21px; border: none; font-weight: bold; }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0% {transform:scale(1);} 50% {transform:scale(1.02);} 100% {transform:scale(1);} }

        /* 模态框 */
        .modal-overlay { z-index: 99999; background: rgba(0,0,0,0.8); }
        .modal-box { border-radius: 20px; background: #fff; }
        .modal-header { background: var(--pepe-green); color: #fff; }
        .close-x { color: #fff !important; }

        /* 拖拽层 */
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框
    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 全局变量 ---
    const DB_KEY = 'pepe_v50_final';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId;
    let activeDownloads = {}, isSending = false, cancelFlag = {}, uploadQueue = [];
    let peerConnection = null, dataChannel = null, isP2PReady = false;

    // 初始化 DB
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. UI 初始化 ---
    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        // 强制注入 iOS 图标 Link (以防 Manifest 不生效)
        let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/png'; link.rel = 'apple-touch-icon'; link.href = './icon.png';
        document.getElementsByTagName('head')[0].appendChild(link);
        
        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#000", colorLight:"#fff"}); }
        }, 500);
    };

    // --- 3. 核心功能函数 ---
    
    // 打开聊天 (强行跳转)
    const openChat = (id) => {
        try { if(window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('chat-online-dot').className = "status-dot red";
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));

        initP2P(id, true);
    };

    // 添加好友
    const handleAddFriend = (id) => {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB(); renderFriends();
        }
        openChat(id);
    };

    // ★ 拨号盘逻辑 (修复握手无效) ★
    let dialInput = "";
    const setupDialpad = () => {
        const body = document.querySelector('#add-overlay .modal-body');
        if(body) body.innerHTML = `
            <div class="numpad-container">
                <div id="dial-display" class="id-display-screen">____</div>
                <div class="numpad-grid">
                    <div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div>
                    <div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div>
                    <div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div>
                    <div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div>
                    <div class="num-btn connect" onclick="dial('OK')">🤝</div>
                </div>
            </div>`;
    };

    window.dial = (k) => {
        const d = document.getElementById('dial-display');
        if(k === 'C') { dialInput=""; d.innerText="____"; return; }
        
        // ★ 核心修复：握手确认 ★
        if(k === 'OK') {
            if(dialInput.length === 4) {
                if(dialInput === MY_ID) { alert("No Self-Chat"); return; }
                // 先关弹窗，再跳转，避免冲突
                document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
                setTimeout(() => handleAddFriend(dialInput), 100);
                dialInput = ""; d.innerText = "____";
            } else { alert("Enter 4 digits"); }
            return;
        }
        
        if(dialInput.length < 4) {
            dialInput += k; d.innerText = dialInput.padEnd(4,'_');
            if(navigator.vibrate) navigator.vibrate(30);
        }
    };

    // --- 4. 网络与传输 ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { document.getElementById('conn-status').className = "status-dot green"; socket.emit('register', MY_ID); });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; });
        
        // P2P 信号
        socket.on('p2p_signal', async (d) => {
            if(!peerConnection && d.type==='offer') initP2P(d.from, false);
            if(peerConnection) {
                try {
                    if(d.type==='offer') {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(d.offer));
                        const ans = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(ans);
                        socket.emit('p2p_signal', {targetId:d.from, type:'answer', answer:ans});
                    } else if(d.type==='answer') {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(d.answer));
                    } else if(d.type==='candidate') {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(d.candidate));
                    }
                } catch(e){}
            }
        });

        // 消息接收
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let f = db.friends.find(x=>x.id===fid);
            if(!f) { f = {id:fid, addedAt:Date.now(), alias:`User ${fid}`, unread:false}; db.friends.push(f); }

            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                f.unread = true; saveDB(); renderFriends();
                if(navigator.vibrate) navigator.vibrate(100);
                document.getElementById('msg-sound').play().catch(()=>{});
            }

            // 隧道文件
            if(msg.type === 'tunnel_file_packet') {
                try { const p = JSON.parse(msg.content); handleTunnelPacket(p, fid); } catch(e){} return;
            }

            // 普通消息
            if(msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid]=[];
                db.history[fid].push({type:msg.type, content:msg.content, isSelf:false, ts:msg.timestamp});
                saveDB();
                if(activeChatId === fid) appendMsgDOM(msg, false);
            }
        });
    }

    // P2P
    const initP2P = async(targetId, isInit) => {
        if(peerConnection) peerConnection.close();
        isP2PReady = false;
        peerConnection = new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
        peerConnection.onicecandidate = e => { if(e.candidate) socket.emit('p2p_signal', {targetId, type:'candidate', candidate:e.candidate}); };
        peerConnection.onconnectionstatechange = () => {
            if(peerConnection.connectionState==='connected') {
                document.getElementById('chat-online-dot').className="status-dot green"; isP2PReady=true;
            }
        };
        if(isInit) {
            dataChannel = peerConnection.createDataChannel("chat"); setupDC(dataChannel);
            const off = await peerConnection.createOffer(); await peerConnection.setLocalDescription(off);
            socket.emit('p2p_signal', {targetId, type:'offer', offer:off});
        } else {
            peerConnection.ondatachannel = e => { dataChannel=e.channel; setupDC(dataChannel); };
        }
    };
    const setupDC = dc => {
        dc.onopen = () => isP2PReady=true;
        dc.onmessage = e => { try{ handleTunnelPacket(JSON.parse(e.data), activeChatId); }catch(err){} };
    };

    // 文件处理
    function handleTunnelPacket(p, fid) {
        if(p.type && !p.subType) { // P2P Msg
            if(!db.history[fid]) db.history[fid]=[];
            db.history[fid].push({type:p.type, content:p.content, isSelf:false, ts:Date.now()});
            saveDB();
            if(activeChatId===fid) appendMsgDOM({type:p.type, content:p.content}, false);
            return;
        }
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId]==='cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = {chunks:[], total:p.totalSize, cur:0, last:0, time:Date.now(), name:p.fileName, type:p.fileType};
                if(activeChatId===fid) appendProgress(fid, p.fileId, p.fileName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data); dl.cur += Math.floor(p.data.length*0.75);
            const now = Date.now();
            if(now - dl.time > 500) {
                const spd = ((dl.cur - dl.last)/1024)/((now-dl.time)/1000);
                if(activeChatId===fid) updateProgress(p.fileId, dl.cur, dl.total, spd);
                dl.last=dl.cur; dl.time=now;
            }
        } else if(p.subType === 'end') {
            if(activeDownloads[p.fileId]==='cancelled') return;
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const b = b64toBlob(dl.chunks.join(''), dl.type);
                const url = URL.createObjectURL(b);
                let type='file';
                if(dl.type.startsWith('image')) type='image';
                else if(dl.type.startsWith('video')) type='video';
                
                const finalMsg = {type, content:url, fileName:dl.name, isSelf:false, ts:Date.now()};
                if(activeChatId===fid) replaceProgress(p.fileId, finalMsg);
                if(!db.history[fid]) db.history[fid]=[];
                db.history[fid].push(finalMsg); saveDB();
                delete activeDownloads[p.fileId];
            }
        }
    }

    // 队列发送
    function addToQueue(f) { uploadQueue.push(f); runQueue(); }
    function runQueue() { if(isSending || uploadQueue.length===0) return; sendFile(uploadQueue.shift()); }

    function sendFile(file) {
        if(!activeChatId) return;
        isSending = true;
        const fileId = Date.now()+'-'+Math.random().toString(36).substr(2,9);
        appendProgress(activeChatId, fileId, file.name, true);
        
        let offset=0, last=0, time=Date.now();
        const readNext = () => {
            if(cancelFlag[fileId]) { isSending=false; setTimeout(runQueue, 500); return; }
            if(offset >= file.size) {
                const end = JSON.stringify({subType:'end', fileId});
                if(isP2PReady && dataChannel.readyState==='open') dataChannel.send(end);
                else socket.emit('send_private', {targetId:activeChatId, type:'tunnel_file_packet', content:end});
                
                let type='file';
                if(file.type.startsWith('image')) type='image';
                else if(file.type.startsWith('video')) type='video';
                
                const m = {type, content:URL.createObjectURL(file), fileName:file.name, isSelf:true};
                replaceProgress(fileId, m);
                if(!db.history[activeChatId]) db.history[activeChatId]=[];
                db.history[activeChatId].push(m); saveDB();
                isSending=false; setTimeout(runQueue, 300); return;
            }
            
            const chunk = file.slice(offset, offset+CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                const p = JSON.stringify({subType:'chunk', fileId, data:b64, fileName:file.name, fileType:file.type, totalSize:file.size});
                
                if(isP2PReady && dataChannel.readyState==='open') dataChannel.send(p);
                else socket.emit('send_private', {targetId:activeChatId, type:'tunnel_file_packet', content:p});
                
                offset += chunk.size;
                const now = Date.now();
                if(now - time > 200) {
                    const spd = ((offset-last)/1024)/((now-time)/1000);
                    updateProgress(fileId, offset, file.size, spd);
                    last=offset; time=now;
                }
                setTimeout(readNext, 5);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // UI 渲染
    function appendMsgDOM(msg, isSelf) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<div style="padding:0;"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px;background:none;box-shadow:none;"><div class="thumb-box" onclick="preview('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type==='file') {
            let icon = '📄';
            if(msg.fileName.match(/\.(doc|docx)$/)) icon='📝';
            else if(msg.fileName.match(/\.(xls|xlsx)$/)) icon='📊';
            html=`<div class="bubble" style="padding:5px;"><a class="doc-card" href="${msg.content}" download="${msg.fileName}"><div style="font-size:24px;">${icon}</div><div style="overflow:hidden;"><div class="doc-name">${msg.fileName}</div><div style="font-size:10px;color:#666;">CLICK SAVE</div></div></a></div>`;
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function appendProgress(cid, fid, name, self) {
        if(activeChatId!==cid) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id=`prog-${fid}`; div.className=`msg-row ${self?'self':'other'}`;
        div.innerHTML=`<div class="bubble" style="min-width:160px;font-size:12px;"><div>${self?'⬆':'⬇'} ${name}</div><div style="background:#eee;height:5px;margin:4px 0;"><div id="bar-${fid}" style="width:0%;height:100%;background:#59BC10;"></div></div><div id="txt-${fid}">0%</div></div>`;
        box.appendChild(div); box.scrollTop=box.scrollHeight;
    }

    function updateProgress(fid, cur, total, spd) {
        const b = document.getElementById(`bar-${fid}`); const t = document.getElementById(`txt-${fid}`);
        if(b) { const p = Math.floor((cur/total)*100); b.style.width=`${p}%`; t.innerText=`${p}% (${spd.toFixed(1)} KB/s)`; }
    }

    function replaceProgress(fid, msg) {
        const r = document.getElementById(`prog-${fid}`);
        if(r) { r.remove(); appendMsgDOM(msg, msg.isSelf); }
    }

    // Helpers
    window.preview = (u,t) => {
        const m = document.getElementById('media-preview-modal');
        document.getElementById('preview-container').innerHTML = t==='image' ? `<img src="${u}" style="max-width:100%;max-height:100vh;">` : `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        document.getElementById('preview-dl').href = u;
        m.classList.remove('hidden');
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.editMyName = () => { const n=prompt("Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); renderProfile(); } };
    
    // ★ 修复：修改昵称 ★
    window.editFriendName = () => { 
        if(activeChatId) {
            const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id);
            if(n) { f.alias=n; saveDB(); renderFriends(); openChat(activeChatId); }
        }
    };

    function renderFriends() {
        const l = document.getElementById('friends-list-container'); l.innerHTML='';
        db.friends.forEach(f => {
            const d = document.createElement('div'); d.className='k-list-item';
            d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px;border-radius:50%;"><div style="flex:1;"><div style="font-weight:bold;">${f.alias||f.id}</div><div>${f.unread?'<span style="color:red">● Msg</span>':'Chat'}</div></div><div class="list-edit-btn" onclick="event.stopPropagation();window.editFriendName2('${f.id}')">✎</div></div>`;
            d.onclick = () => { f.unread=false; saveDB(); renderFriends(); openChat(f.id); };
            l.appendChild(d);
        });
    }
    // 列表页修改入口
    window.editFriendName2 = (fid) => {
        const f=db.friends.find(x=>x.id===fid); const n=prompt("Alias:", f.alias||f.id);
        if(n) { f.alias=n; saveDB(); renderFriends(); }
    }

    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // Binds
    document.getElementById('chat-send-btn').onclick = () => { const t = document.getElementById('chat-input'); if(t.value) { sendData('text', t.value); t.value=''; } };
    // ★ 修复：返回键 ★
    document.getElementById('chat-back-btn').onclick = () => { 
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'),50);
        activeChatId=null; renderFriends();
    };
    
    // 附件
    const fIn = document.getElementById('chat-file-input');
    fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); };
    
    // 拖拽
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', ()=>{ if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', ()=>{ drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e=>{ 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId) {
             if(e.dataTransfer.items) {
                 for(let i=0; i<e.dataTransfer.items.length; i++) {
                     const item = e.dataTransfer.items[i].webkitGetAsEntry();
                     if(item) traverseFileTree(item);
                 }
             }
        }
    });

    // 拨号盘绑定
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{
            if(window.Html5Qrcode) {
                const s = new Html5Qrcode("qr-reader"); window.scanner=s;
                s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); handleAddFriend(t); }); });
            }
        },300);
    };
    
    // 表情
    const sg = document.getElementById('sticker-grid'); sg.innerHTML='';
    const gifs = ["https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif", "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif", "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif"];
    gifs.forEach(s => { const i=document.createElement('img'); i.src=s; i.className='sticker-img'; i.style.width='60px'; i.onclick=()=>{sendData('sticker', s); document.getElementById('sticker-panel').classList.add('hidden');}; sg.appendChild(i); });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    document.querySelector('.user-pill').onclick = window.editMyName;

    // 初始化
    renderProfile(); renderFriends(); setupDialpad();
});
