// chatbot.js — Chat IA exclusivo Premium
(function () {
  const chatBoton = document.getElementById('chat-boton');
  const chatWindow = document.getElementById('chat-window');
  const cerrarBtn = document.getElementById('cerrar-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const enviarBtn = document.getElementById('enviar-chat-btn');

  if (!chatBoton || !chatWindow) return;

  let chatAbierto = false;
  let currentUser = null;
  let chatStorageKey = 'chatHistorial:anon';
  let syncChannel = null;

  if ('BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('foraneo-sync');
  }

  // Mostrar el botón solo si el usuario tiene acceso al chat
  function verificarPremium() {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(user => {
        currentUser = user;
        chatStorageKey = 'chatHistorial:' + user.id;
        historial = JSON.parse(localStorage.getItem(chatStorageKey) || '[]');
        cargarChat();
        const prefs = user.preferencias || [];
        const hasChat = user.es_premium || user.rol === 'premium' || prefs.some(p => {
          if (typeof p === 'string' && p.startsWith('PERMISO_CHAT:')) {
            const exp = p.substring(p.indexOf(':') + 1);
            if (exp === 'PERMANENT') return true;
            return new Date(exp) > new Date();
          }
          return false;
        });
        if (hasChat) chatBoton.classList.add('premium-visible');
      })
      .catch(() => { });
  }

  // --- Persistencia ---
  let historial = JSON.parse(localStorage.getItem(chatStorageKey) || '[]');

  function guardarChat(texto, tipo) {
    historial.push({ texto, tipo });
    localStorage.setItem(chatStorageKey, JSON.stringify(historial.slice(-80)));
  }

  function cargarChat() {
    if (historial.length > 0) {
      chatMessages.innerHTML = '';
      historial.forEach(m => {
        const div = document.createElement('div');
        div.className = 'msg msg-' + m.tipo;
        div.textContent = m.texto;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function agregarAccionesRapidas() {
    if (document.getElementById('chat-quick-actions')) return;
    const wrap = document.createElement('div');
    wrap.id = 'chat-quick-actions';
    wrap.className = 'chat-quick-actions';
    [
      'Organiza mis comidas de la semana',
      'Haz lista de compras',
      'Solo quiero recetas coreanas',
      'Resumen de mi plan',
      'Recetas saludables con pollo'
    ].forEach(texto => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-chip';
      btn.textContent = texto;
      btn.addEventListener('click', () => {
        chatInput.value = texto;
        enviarMensaje();
      });
      wrap.appendChild(btn);
    });
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatBoton.addEventListener('click', () => {
    chatAbierto = !chatAbierto;
    chatWindow.style.display = chatAbierto ? 'flex' : 'none';
    
    // Cambiar icono: X para cerrar (y limpiar), Robot para abrir
    chatBoton.innerHTML = chatAbierto ? '<i data-lucide="x"></i>' : '<i data-lucide="bot"></i>';
    lucide.createIcons();

    if (chatAbierto) {
      chatInput.focus();
      // Si no hay historial, mostrar bienvenida
      if (historial.length === 0) {
        setTimeout(() => {
          agregarMensaje("¡Hola! Soy tu Chef IA. ¿En qué puedo ayudarte?", "bot");
          agregarMensaje("Puedes escribir tus dudas o pedir ayuda sobre recetas, planificación o compras.", "bot");
          agregarAccionesRapidas();
        }, 500);
      }
    } else {
      // Al cerrar desde el botón flotante (X), limpiamos TODO
      chatMessages.innerHTML = '';
      historial = [];
      localStorage.removeItem(chatStorageKey);
    }
  });

  cerrarBtn.addEventListener('click', () => {
    // El botón de la cabecera (Minimizar) solo oculta, preservando la charla en memoria y storage
    chatAbierto = false;
    chatWindow.style.display = 'none';
    chatBoton.innerHTML = '<i data-lucide="bot"></i>';
    lucide.createIcons();
  });

  function agregarMensaje(texto, tipo) {
    const div = document.createElement('div');
    div.className = 'msg msg-' + tipo;
    div.textContent = texto;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Guardar en el historial para persistencia
    guardarChat(texto, tipo);
    
    return div;
  }

  // Cargar chat al iniciar
  cargarChat();
  verificarPremium();

  function agregarRecetas(recetas) {
    if (!recetas || recetas.length === 0) return;

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 6px; align-self: flex-start; width: 85%;';

    recetas.forEach(r => {
      const imgSrc = r.imagen || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E";

      const card = document.createElement('div');
      card.className = 'chat-receta-card';
      card.innerHTML =
        '<img class="chat-receta-img" src="' + imgSrc + '" alt="Receta" onerror="this.style.display=\'none\'">' +
        '<div class="chat-receta-info">' +
        '<div class="chat-receta-titulo">' + (r.titulo || 'Sin titulo') + '</div>' +
        '<div class="chat-receta-meta">' + (r.precio || '') + ' · ' + (r.tiempo || '') + ' · ❤️ ' + (r.likes || 0) + '</div>' +
        '</div>';

      card.addEventListener('click', () => {
        window.location.href = 'receta.html?id=' + r.id;
      });

      container.appendChild(card);
    });

    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function mostrarTyping() {
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function ocultarTyping() {
    const typing = document.getElementById('typing');
    if (typing) typing.remove();
  }

  function emitirSincronizacion(sync) {
    if (!sync || typeof sync !== 'object') return;
    const payload = { sync, ts: Date.now(), userId: currentUser?.id || null };
    localStorage.setItem('fk:last-sync', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('fk:sync', { detail: payload }));
    if (syncChannel) syncChannel.postMessage(payload);
  }

  async function enviarMensaje() {
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';
    enviarBtn.disabled = true;

    mostrarTyping();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mensaje: texto })
      });

      ocultarTyping();

      if (response.status === 403) {
        agregarMensaje('🔒 El Chef IA es exclusivo para usuarios Premium. ¡Acumula puntos para desbloquear!', 'bot');
        return;
      }

      if (!response.ok) throw new Error('Error del servidor');

      const data = await response.json();
      if (data.respuesta) agregarMensaje(data.respuesta, 'bot');
      if (data.recetas && data.recetas.length > 0) agregarRecetas(data.recetas);
      if (data.sync) emitirSincronizacion(data.sync);
      if (Array.isArray(data.acciones) && data.acciones.length > 0) {
        const nota = document.createElement('div');
        nota.className = 'chat-action-note';
        nota.textContent = 'Cambios sincronizados: ' + data.acciones.join(', ');
        chatMessages.appendChild(nota);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

    } catch (error) {
      ocultarTyping();
      agregarMensaje('😕 Ups, tuve un problema. Intenta de nuevo.', 'bot');
      console.error('Error chatbot:', error);
    } finally {
      enviarBtn.disabled = false;
      chatInput.focus();
    }
  }

  enviarBtn.addEventListener('click', enviarMensaje);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  verificarPremium();
})();
