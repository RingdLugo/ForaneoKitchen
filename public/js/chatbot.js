// chatbot.js - Chef IA para usuarios Premium
// Algoritmo: NLU con clasificación de intenciones + búsqueda por similitud coseno

(function() {
  const chatBoton = document.getElementById('chat-boton');
  const chatWindow = document.getElementById('chat-window');
  const cerrarBtn = document.getElementById('cerrar-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const enviarBtn = document.getElementById('enviar-chat-btn');

  if (!chatBoton || !chatWindow) return;

  let chatAbierto = false;

  // Verificar si el usuario es Premium para mostrar el botón
  function verificarPremium() {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(user => {
      if (user.es_premium || user.rol === 'premium') {
        chatBoton.style.display = 'flex';
      }
    })
    .catch(() => {});
  }

  // Abrir/cerrar chat
  chatBoton.addEventListener('click', () => {
    chatAbierto = !chatAbierto;
    chatWindow.style.display = chatAbierto ? 'flex' : 'none';
    chatBoton.textContent = chatAbierto ? '✖' : '🤖';
    
    if (chatAbierto) {
      chatInput.focus();
      // Mensaje de bienvenida si el chat está vacío
      if (chatMessages.children.length <= 1) { // 1 msg por el default en HTML
        setTimeout(() => {
          agregarMensaje("Hola 👋, puedes escribir tus dudas o pedir ayuda sobre recetas, planificación o compras.", "bot");
        }, 500);
      }
    }
  });

  cerrarBtn.addEventListener('click', () => {
    chatAbierto = false;
    chatWindow.style.display = 'none';
    chatBoton.textContent = '🤖';
  });

  // Agregar mensaje al chat
  function agregarMensaje(texto, tipo) {
    const div = document.createElement('div');
    div.className = 'msg msg-' + tipo;
    div.textContent = texto;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  // Agregar recetas al chat
  function agregarRecetas(recetas) {
    if (!recetas || recetas.length === 0) return;

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 6px; align-self: flex-start; width: 85%;';

    recetas.forEach(r => {
      const imgSrc = r.imagen || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e8f5e9'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%234caf50' font-size='40'%3E🍳%3C/text%3E%3C/svg%3E";
      
      const card = document.createElement('div');
      card.className = 'chat-receta-card';
      card.innerHTML = 
        '<img class="chat-receta-img" src="' + imgSrc + '" alt="' + (r.titulo || '') + '" onerror="this.style.display=\'none\'">' +
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

  // Indicador de escritura
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

  // Enviar mensaje al backend
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
      
      if (data.respuesta) {
        agregarMensaje(data.respuesta, 'bot');
      }
      
      if (data.recetas && data.recetas.length > 0) {
        agregarRecetas(data.recetas);
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

  // Event listeners
  enviarBtn.addEventListener('click', enviarMensaje);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  // Iniciar
  verificarPremium();
})();
