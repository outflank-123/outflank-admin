// Admin login has no session check — it's the login page itself
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
