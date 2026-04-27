import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSuccess(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      // Mock for local preview if Supabase is not connected
      if (import.meta.env.DEV && (!import.meta.env.VITE_SUPABASE_URL)) {
        console.warn('Mocking success in dev mode...');
        onSuccess({ id: 'mock_user', email });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-12"
      >
        <div className="text-center space-y-4">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 5 }}
            className="inline-block p-4 bg-white rounded-3xl shadow-xl shadow-black/5"
          >
            <Sparkles className="w-8 h-8 text-fg" />
          </motion.div>
          <h1 className="serif text-5xl italic font-medium">Aura Archive</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">
            {isLogin ? 'Enter your aesthetic universe' : 'Begin your curation journey'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative group">
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fg transition-colors" />
              <input 
                required
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl outline-none focus:ring-1 focus:ring-fg transition-all shadow-sm"
              />
            </div>
            <div className="relative group">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fg transition-colors" />
              <input 
                required
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl outline-none focus:ring-1 focus:ring-fg transition-all shadow-sm"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center font-medium px-4">{error}</p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className={cn(
              "w-full bg-fg text-white py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-black/5 font-medium tracking-wide",
              loading ? "opacity-50 cursor-wait" : "hover:scale-[0.98]"
            )}
          >
            {isLogin ? 'Sign In' : 'Create Account'}
            {isLogin ? <LogIn className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-gray-400 hover:text-fg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isLogin ? (
              <>
                <UserPlus className="w-3 h-3" />
                No account? Create your archive
              </>
            ) : (
              'Already have an archive? Sign in'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
