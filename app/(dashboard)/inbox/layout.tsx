/**
 * The Inbox uses a full-screen layout with no padding, overriding
 * the default dashboard layout's max-width and padding constraints.
 * It still lives inside (dashboard) so auth is protected.
 */
export default function InboxLayout({ children }: { children: React.ReactNode }) {
  // Render children directly — the AdminSidebar comes from the parent (dashboard) layout
  // We just need to break out of the max-w-[1200px] padded main wrapper.
  return (
    <div
      className="fixed inset-0 left-[260px] z-10 overflow-hidden"
      style={{ top: 0, bottom: 0 }}
    >
      {children}
    </div>
  )
}
