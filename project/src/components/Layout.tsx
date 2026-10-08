import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, BookOpen, Search, Users, UploadCloud, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = location.pathname === '/';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const navLinks = [
    { to: '/courses', label: 'Browse Courses', icon: BookOpen },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/groups', label: 'Study Groups', icon: Users },
    ...(profile ? [{ to: '/contribute', label: 'Add Materials', icon: UploadCloud }] : []),
    ...(profile?.role === 'admin' ? [{ to: '/admin/upload', label: 'Admin', icon: ShieldCheck }] : []),
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className={`sticky top-0 z-40 transition-all duration-300 ${isLanding ? 'bg-transparent' : 'bg-white/95 backdrop-blur border-b border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className={`font-bold text-sm ${isLanding ? 'text-white' : 'text-slate-900'}`}>Armarium</div>
                <div className={`text-[10px] ${isLanding ? 'text-emerald-100' : 'text-slate-500'}`}>Study Repository</div>
            </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname.startsWith(link.to)
                      ? (isLanding ? 'text-white bg-white/15' : 'text-emerald-700 bg-emerald-50')
                      : (isLanding ? 'text-emerald-50 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {profile ? (
                <>
                  <div className={`text-sm ${isLanding ? 'text-emerald-50' : 'text-slate-600'}`}>
                    {profile.full_name.split(' ')[0]}
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleSignOut} className={isLanding ? 'text-white hover:bg-white/15' : ''}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/signin">
                    <Button size="sm" variant="ghost" className={isLanding ? 'text-white hover:bg-white/15' : ''}>
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm" variant="primary">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className={`w-6 h-6 ${isLanding ? 'text-white' : 'text-slate-700'}`} />
              ) : (
                <Menu className={`w-6 h-6 ${isLanding ? 'text-white' : 'text-slate-700'}`} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <link.icon className="w-4 h-4 text-slate-400" />
                {link.label}
              </Link>
            ))}
            {profile ? (
              <>
                <Button size="sm" variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/signin" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button size="sm" variant="primary" className="w-full">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-slate-900 text-slate-400 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-white">Armarium</span>
              <span className="mx-2">·</span>
              <span>Independent Study Repository</span>
            </div>
          </div>
          <p className="text-xs">Past papers, quizzes, assignments & AI-powered solutions</p>
        </div>
      </footer>
    </div>
  );
}
