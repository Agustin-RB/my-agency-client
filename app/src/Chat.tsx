import React, { useState } from 'react';
import styles from './Chat.module.css';

interface Message {
  id: number;
  sender: string;
  content: string;
  time: string;
  isOwn: boolean;
  avatar: string;
}

interface Conversation {
  id: number;
  name: string;
  type: 'project' | 'direct';
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: number;
  members: string[];
}

function Chat() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [conversations] = useState<Conversation[]>([
    {
      id: 1,
      name: 'Agencia de marketing',
      type: 'project',
      avatar: 'project',
      lastMessage: 'María: ¿Ya revisaron los mockups?',
      time: 'Hace 5 min',
      unread: 3,
      members: ['María García', 'Carlos López']
    },
    {
      id: 2,
      name: 'Brand Identity',
      type: 'project',
      avatar: 'project',
      lastMessage: 'Carlos: Envío la última versión',
      time: 'Hace 1h',
      members: ['María García', 'Ana Martínez']
    },
    {
      id: 3,
      name: 'María García',
      type: 'direct',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      lastMessage: 'Perfecto, gracias!',
      time: 'Ayer',
      members: ['María García']
    },
    {
      id: 4,
      name: 'Carlos López',
      type: 'direct',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      lastMessage: 'Nos vemos mañana',
      time: 'Ayer',
      members: ['Carlos López']
    }
  ]);

  const [messages, setMessages] = useState<{ [key: number]: Message[] }>({
    1: [
      {
        id: 1,
        sender: 'María García',
        content: '¡Hola equipo! ¿Ya revisaron los mockups que subí ayer?',
        time: '10:30',
        isOwn: false,
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
      },
      {
        id: 2,
        sender: 'Carlos López',
        content: 'Sí, se ven muy bien. Solo tengo unas sugerencias en el header.',
        time: '10:35',
        isOwn: false,
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      },
      {
        id: 3,
        sender: 'Tú',
        content: 'Perfecto, voy a hacer los ajustes esta tarde.',
        time: '10:40',
        isOwn: true,
        avatar: 'https://randomuser.me/api/portraits/men/50.jpg'
      }
    ],
    2: [
      {
        id: 1,
        sender: 'Ana Martínez',
        content: '¿Qué tal si usamos esta paleta de colores?',
        time: '09:15',
        isOwn: false,
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
      },
      {
        id: 2,
        sender: 'Tú',
        content: 'Me gusta mucho, es muy profesional.',
        time: '09:20',
        isOwn: true,
        avatar: 'https://randomuser.me/api/portraits/men/50.jpg'
      }
    ]
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || selectedConversation === null) return;

    const newMessage: Message = {
      id: (messages[selectedConversation]?.length || 0) + 1,
      sender: 'Tú',
      content: messageInput,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      avatar: 'https://randomuser.me/api/portraits/men/50.jpg'
    };

    setMessages(prev => ({
      ...prev,
      [selectedConversation]: [...(prev[selectedConversation] || []), newMessage]
    }));

    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className={styles.chatContainer}>
      {/* Lista de conversaciones */}
      <div className={styles.conversationsList}>
        <div className={styles.conversationsHeader}>
          <h2>Mensajes</h2>
          <input
            type="text"
            className={styles.searchBox}
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.conversations}>
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`${styles.conversationItem} ${selectedConversation === conv.id ? styles.active : ''}`}
              onClick={() => setSelectedConversation(conv.id)}
            >
              <div className={styles.conversationAvatar}>
                {conv.type === 'project' ? (
                  <i className="ri-folder-3-line" style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }} />
                ) : (
                  <img src={conv.avatar} alt={conv.name} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
                )}
              </div>
              <div className={styles.conversationInfo}>
                <div className={styles.conversationName}>
                  <span>{conv.name}</span>
                  {conv.unread && <span className={styles.unreadBadge}>{conv.unread}</span>}
                </div>
                <div className={styles.conversationPreview}>{conv.lastMessage}</div>
                <div className={styles.conversationTime}>{conv.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área de chat */}
      <div className={styles.chatArea}>
        {selectedConv ? (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderInfo}>
                <div className={styles.chatHeaderAvatar}>
                  {selectedConv.type === 'project' ? (
                    <i className="ri-folder-3-line" style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }} />
                  ) : (
                    <img src={selectedConv.avatar} alt={selectedConv.name} style={{ width: '100%', height: '100%', borderRadius: '10px' }} />
                  )}
                </div>
                <div className={styles.chatHeaderTitle}>
                  <h3>{selectedConv.name}</h3>
                  <p>{selectedConv.type === 'project' ? `${selectedConv.members.length} miembros` : 'Mensaje directo'}</p>
                </div>
              </div>
            </div>

            <div className={styles.messagesContainer}>
              {messages[selectedConversation!]?.map((msg) => (
                <div key={msg.id} className={`${styles.message} ${msg.isOwn ? styles.own : ''}`}>
                  <img src={msg.avatar} alt={msg.sender} className={styles.messageAvatar} />
                  <div className={styles.messageContent}>
                    {!msg.isOwn && (
                      <div className={styles.messageHeader}>
                        <span className={styles.messageSender}>{msg.sender}</span>
                        <span className={styles.messageTime}>{msg.time}</span>
                      </div>
                    )}
                    <div className={styles.messageBubble}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.messageInput}>
              <div className={styles.attachWrapper}>
                <button
                  className={styles.attachBtn}
                  onClick={() => setShowAttachMenu(v => !v)}
                  title="Adjuntar"
                >
                  <i className="ri-add-line" />
                </button>
                {showAttachMenu && (
                  <div className={styles.attachMenu}>
                    <button
                      className={styles.attachMenuItem}
                      onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                    >
                      <i className="ri-paperclip-line" />
                      <span>Adjuntar archivo</span>
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setMessageInput(prev => prev + (prev ? ' ' : '') + `[Archivo: ${file.name}]`);
                    e.target.value = '';
                  }}
                />
              </div>
              <input
                type="text"
                placeholder={`Mensaje a ${selectedConv.name}...`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                onClick={() => setShowAttachMenu(false)}
              />
              <button
                className={styles.sendButton}
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
              >
                Enviar
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
            <p>Selecciona una conversación para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;





