import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'zojuist';
  if (diffMin < 60) return `${diffMin} min geleden`;
  if (diffHour < 24) return `${diffHour} uur geleden`;
  if (diffDay < 7) return `${diffDay} dag${diffDay === 1 ? '' : 'en'} geleden`;
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api('/notifications/unread-count'),
    refetchInterval: 30000,
  });

  const unreadCount = countData?.count || 0;

  // Fetch recent notifications when dropdown is open
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api('/notifications?limit=10'),
    enabled: isOpen,
  });

  const notifications = notifData?.notifications || [];

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = useCallback((notif) => {
    if (!notif.read_at) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.link) {
      // Extract relative path from full URL
      try {
        const url = new URL(notif.link);
        navigate(url.pathname + url.search);
      } catch {
        // If it's already a relative path
        navigate(notif.link);
      }
    }
    setIsOpen(false);
  }, [markReadMutation, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notificaties${unreadCount > 0 ? ` (${unreadCount} ongelezen)` : ''}`}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        {/* Bell SVG icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '.65rem',
              fontWeight: 700,
              borderRadius: '9999px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '340px',
            maxHeight: '420px',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: '10px',
            boxShadow: '0 4px 24px rgba(0,0,0,.12)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: '.75rem 1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: '.95rem' }}>Notificaties</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--light-blue, #2563eb)',
                  fontSize: '.8rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Alles gelezen
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '.875rem' }}>
              Geen notificaties
            </div>
          ) : (
            <div>
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '.65rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    background: notif.read_at ? '#fff' : '#f0f7ff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = notif.read_at ? '#fff' : '#f0f7ff'; }}
                >
                  <div style={{
                    fontSize: '.85rem',
                    fontWeight: notif.read_at ? 400 : 600,
                    color: '#1e293b',
                    marginBottom: '2px',
                    lineHeight: 1.3,
                  }}>
                    {notif.title}
                  </div>
                  <div style={{
                    fontSize: '.75rem',
                    color: '#94a3b8',
                  }}>
                    {formatRelativeTime(notif.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
