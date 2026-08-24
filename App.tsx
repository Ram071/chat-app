import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Hash,
  Loader2,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Smile,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Room = {
  id: string;
  name: string;
  created_at: string;
};

type Message = {
  id: string;
  room_id: string;
  username: string;
  content: string;
  created_at: string;
};

const starterRooms = ['General', 'Product ideas', 'Random'];

function formatMessageTime(timestamp: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

function formatDay(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(date);
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('chat-username') ?? '');
  const [nameDraft, setNameDraft] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomError, setRoomError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find((room) => room.id === activeRoomId);

  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<string, Message[]>>((groups, message) => {
      const day = formatDay(message.created_at);
      groups[day] = groups[day] ? [...groups[day], message] : [message];
      return groups;
    }, {});
  }, [messages]);

  useEffect(() => {
    const loadRooms = async () => {
      const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: true });
      if (error) {
        setRoomError('Could not load rooms. Please refresh and try again.');
      } else if (data && data.length > 0) {
        setRooms(data);
        setActiveRoomId(data[0].id);
      } else {
        const created = await Promise.all(
          starterRooms.map((name) => supabase.from('rooms').insert({ name }).select().maybeSingle()),
        );
        const createdRooms = created.map((result) => result.data).filter((room): room is Room => Boolean(room));
        setRooms(createdRooms);
        setActiveRoomId(createdRooms[0]?.id ?? '');
      }
      setIsLoadingRooms(false);
    };
    void loadRooms();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    setIsLoadingMessages(true);
    setMessageError('');

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', activeRoomId)
        .order('created_at', { ascending: true });
      if (error) {
        setMessageError('Could not load messages for this room.');
      } else {
        setMessages(data ?? []);
      }
      setIsLoadingMessages(false);
    };

    void loadMessages();
    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoomId}` }, (payload) => {
        setMessages((current) => current.some((message) => message.id === payload.new.id) ? current : [...current, payload.new as Message]);
      })
      .subscribe((status) => setIsOnline(status === 'SUBSCRIBED'));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoomId]);

  const joinChat = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = nameDraft.trim();
    if (!cleanName) return;
    localStorage.setItem('chat-username', cleanName);
    setUsername(cleanName);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !activeRoomId || isSending) return;
    setIsSending(true);
    setMessageError('');
    const optimisticMessage: Message = {
      id: crypto.randomUUID(), room_id: activeRoomId, username, content, created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);
    setMessageDraft('');
    const { error } = await supabase.from('messages').insert({ room_id: activeRoomId, username, content });
    if (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setMessageDraft(content);
      setMessageError('Your message could not be sent. Please try again.');
    }
    setIsSending(false);
  };

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newRoomName.trim();
    if (!name || isCreatingRoom) return;
    setIsCreatingRoom(true);
    const { data, error } = await supabase.from('rooms').insert({ name }).select().maybeSingle();
    if (error || !data) {
      setRoomError('Could not create that room. Please try again.');
    } else {
      setRooms((current) => [...current, data]);
      setActiveRoomId(data.id);
      setNewRoomName('');
    }
    setIsCreatingRoom(false);
  };

  const leaveChat = () => {
    localStorage.removeItem('chat-username');
    setUsername('');
    setNameDraft('');
  };

  if (!username) {
    return (
      <main className="welcome-shell">
        <div className="welcome-art" aria-hidden="true"><span /><span /><span /><span /></div>
        <section className="welcome-card">
          <div className="brand-mark"><MessageCircle size={25} strokeWidth={2.5} /></div>
          <p className="eyebrow">A quieter place to connect</p>
          <h1>Good conversations<br /><em>start here.</em></h1>
          <p className="welcome-copy">Join the room and share what’s on your mind. No account needed — just your name.</p>
          <form className="name-form" onSubmit={joinChat}>
            <label htmlFor="display-name">What should we call you?</label>
            <div className="name-input-wrap"><span>@</span><input id="display-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Your display name" maxLength={32} autoFocus /></div>
            <button className="primary-button" type="submit" disabled={!nameDraft.trim()}>Enter the chat <ArrowUp size={17} /></button>
          </form>
          <div className="privacy-note"><Check size={15} /> Your name is only used in this chat</div>
        </section>
        <div className="welcome-footer"><span>CHAT / 01</span><span>Made for meaningful exchange</span></div>
      </main>
    );
  }

  return (
    <div className="chat-app">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : 'is-closed'}`}>
        <div className="sidebar-top">
          <div className="brand"><div className="brand-mark small"><MessageCircle size={18} /></div><span>common<span className="brand-dot">.</span></span></div>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>
        <div className="profile-row"><div className="avatar user-avatar">{initials(username)}</div><div className="profile-copy"><strong>{username}</strong><span><i className="online-dot" /> Active now</span></div><button className="icon-button" aria-label="Profile options"><MoreHorizontal size={18} /></button></div>
        <div className="sidebar-section"><div className="section-heading"><span>Rooms</span><button className="add-room-button" onClick={() => setIsCreatingRoom((value) => !value)} aria-label="Create room"><Plus size={16} /></button></div>
          {isCreatingRoom && <form className="room-form" onSubmit={createRoom}><input autoFocus value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="Room name" maxLength={28} /><button type="submit" disabled={!newRoomName.trim()}><Check size={15} /></button></form>}
          {roomError && <p className="inline-error">{roomError}</p>}
          <nav className="room-list">{isLoadingRooms ? <div className="loading-row"><Loader2 size={16} className="spin" /> Loading rooms</div> : rooms.map((room) => <button className={`room-item ${room.id === activeRoomId ? 'active' : ''}`} key={room.id} onClick={() => { setActiveRoomId(room.id); setSidebarOpen(false); }}><Hash size={17} /><span>{room.name}</span>{room.id === activeRoomId && <span className="room-active-dot" />}</button>)}</nav>
        </div>
        <div className="sidebar-bottom"><div className="workspace-label"><span className="workspace-icon"><Users size={16} /></span><div><strong>Common space</strong><span>{rooms.length} rooms · Public</span></div></div><button className="leave-button" onClick={leaveChat}><LogOut size={16} /> Leave chat</button></div>
      </aside>
      <main className="conversation">
        <header className="conversation-header"><button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar">{sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button><div className="room-title"><div className="room-title-icon"><Hash size={19} /></div><div><h2>{activeRoom?.name ?? 'Chat room'}</h2><span>{isOnline ? 'Everyone can join the conversation' : 'Reconnecting…'}</span></div></div><div className="header-actions"><div className={`connection-status ${isOnline ? '' : 'offline'}`}>{isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{isOnline ? 'Live' : 'Offline'}</span></div><button className="icon-button" aria-label="Search messages"><Search size={19} /></button><button className="icon-button" aria-label="More options"><MoreHorizontal size={20} /></button></div></header>
        <div className="message-area">{messageError && <div className="message-error">{messageError}</div>}{isLoadingMessages ? <div className="empty-state"><Loader2 size={24} className="spin" /><p>Loading conversation…</p></div> : Object.keys(groupedMessages).length === 0 ? <div className="empty-state"><div className="empty-icon"><MessageCircle size={24} /></div><h3>No messages yet</h3><p>Start the conversation in <strong>#{activeRoom?.name}</strong>.</p></div> : Object.entries(groupedMessages).map(([day, dayMessages]) => <div className="message-group" key={day}><div className="date-divider"><span>{day}</span></div>{dayMessages.map((message, index) => <article className={`message ${message.username === username ? 'own-message' : ''}`} key={message.id}><div className="avatar message-avatar">{initials(message.username)}</div><div className="message-body"><div className="message-meta"><strong>{message.username}</strong><time>{formatMessageTime(message.created_at)}</time>{message.username === username && <span className="you-label">you</span>}</div><p>{message.content}</p></div></article>)}</div>)}<div ref={messagesEndRef} /></div>
        <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}><button type="button" className="composer-tool" aria-label="Add attachment"><Plus size={20} /></button><input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder={`Message #${activeRoom?.name ?? 'room'}`} maxLength={1000} /><button type="button" className="composer-tool" aria-label="Add emoji"><Smile size={20} /></button><button className="send-button" type="submit" disabled={!messageDraft.trim() || isSending} aria-label="Send message">{isSending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}</button></form><div className="composer-hint"><span>Press <kbd>Enter</kbd> to send</span><span>{messageDraft.length > 0 ? `${messageDraft.length}/1000` : 'Be kind. Stay curious.'}</span></div></div>
      </main>
    </div>
  );
}

export default App;
