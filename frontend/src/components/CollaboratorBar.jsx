import { useState } from 'react'

function CollaboratorBar({ onlineUsers, activity }) {
  const [showActivity, setShowActivity] = useState(false)
  const unreadCount = activity.filter((a) => a.type === 'comment' || a.type === 'fix').length

  return (
    <div className="flex items-center gap-3">
      {/* User avatars */}
      <div className="flex items-center -space-x-1.5">
        {onlineUsers.slice(0, 5).map((user, i) => (
          <div
            key={user.sid || i}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg-primary border-2 border-bg-primary"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {onlineUsers.length > 5 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-bg-tertiary text-text-secondary border-2 border-bg-primary">
            +{onlineUsers.length - 5}
          </div>
        )}
      </div>
      <span className="text-xs text-text-secondary">
        {onlineUsers.length} {onlineUsers.length === 1 ? 'viewer' : 'viewers'}
      </span>

      {/* Activity bell */}
      <div className="relative">
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="relative p-1.5 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-severity-critical rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showActivity && (
          <div className="absolute right-0 top-8 w-72 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border-primary">
              <h4 className="text-xs font-medium text-text-primary">Activity</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="px-3 py-4 text-xs text-text-secondary text-center">No activity yet</p>
              ) : (
                [...activity].reverse().slice(0, 20).map((item, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border-primary/50 last:border-0">
                    <p className="text-xs text-text-primary">
                      <span className="font-medium">{item.user_name}</span>{' '}
                      {item.type === 'join' && 'joined the review'}
                      {item.type === 'leave' && 'left the review'}
                      {item.type === 'comment' && `commented: "${item.content?.slice(0, 50)}"`}
                      {item.type === 'status' && `${item.status} a finding`}
                      {item.type === 'fix' && `applied a fix to ${item.file_name}`}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {new Date(item.time).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollaboratorBar
