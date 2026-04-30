import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Plus, FolderPlus, Image as ImageIcon, 
  Search, X, ChevronRight, ChevronDown, 
  MoreHorizontal, Folder, Home, LogOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import { supabase } from './lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface AestheticItem {
  id: string;
  url: string;
  sourceUrl?: string;
  title: string;
  categoryId: string | null;
  aspect: 'portrait' | 'landscape' | 'square';
}

interface DatabaseCategory {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
}

interface DatabaseItem {
  id: string;
  title: string | null;
  url: string;
  source_url: string | null;
  aspect: AestheticItem['aspect'] | null;
  category_id: string | null;
  user_id: string;
}

// --- Initial Data ---
const INITIAL_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Collection', parentId: null },
  { id: '1', name: '2026 Trends', parentId: 'all' },
  { id: '1-1', name: 'Minimalist Tokyo', parentId: '1' },
  { id: '1-2', name: 'Cyberpunk Vision', parentId: '1' },
  { id: '2', name: 'Interior Space', parentId: 'all' },
  { id: '2-1', name: 'Zen Garden', parentId: '2' },
];

const INITIAL_ITEMS: AestheticItem[] = [
  { id: '1', categoryId: '1-1', url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=800', sourceUrl: 'https://unsplash.com/photos/shibuya-crossing-tokyo-japan-T-09_S_A-H8', title: 'Shibuya Morning', aspect: 'portrait' },
  { id: '2', categoryId: '1-1', url: 'https://images.unsplash.com/photo-1493760790601-3d508bc3ddab?q=80&w=800', sourceUrl: 'https://unsplash.com/photos/gray-concrete-wall-7_T_A-H8', title: 'Concrete Texture', aspect: 'square' },
  { id: '3', categoryId: '1-2', url: 'https://images.unsplash.com/photo-1515462277126-2dd0c162007a?q=80&w=800', sourceUrl: 'https://unsplash.com/photos/pink-neon-sign-7_T_A-H8', title: 'Neon Pulse', aspect: 'landscape' },
  { id: '4', categoryId: '2-1', url: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?q=80&w=800', sourceUrl: 'https://unsplash.com/photos/stones-on-sand-7_T_A-H8', title: 'Zen Stones', aspect: 'portrait' },
];

const ROOT_CATEGORY_ID = 'all';
const LOCAL_CATEGORIES_KEY = 'aura_nested_categories';
const LOCAL_ITEMS_KEY = 'aura_nested_items';

const getSavedCategories = () => {
  const saved = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  return saved ? JSON.parse(saved) as Category[] : INITIAL_CATEGORIES;
};

const getSavedItems = () => {
  const saved = localStorage.getItem(LOCAL_ITEMS_KEY);
  return saved ? JSON.parse(saved) as AestheticItem[] : INITIAL_ITEMS;
};

const withRootCategory = (categories: Category[]) => [
  INITIAL_CATEGORIES[0],
  ...categories.filter((category) => category.id !== ROOT_CATEGORY_ID),
];

const isDatabaseId = (id: string | null) => (
  Boolean(id?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
);

const toCategory = (category: DatabaseCategory): Category => ({
  id: category.id,
  name: category.name,
  parentId: category.parent_id ?? ROOT_CATEGORY_ID,
});

const toItem = (item: DatabaseItem): AestheticItem => ({
  id: item.id,
  title: item.title || 'Untitled',
  url: item.url,
  sourceUrl: item.source_url || undefined,
  aspect: item.aspect || 'square',
  categoryId: item.category_id,
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>(getSavedCategories);
  const [items, setItems] = useState<AestheticItem[]>(getSavedItems);

  const [activeCategoryId, setActiveCategoryId] = useState(ROOT_CATEGORY_ID);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [newCatName, setNewCatName] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemSourceUrl, setNewItemSourceUrl] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
    localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
  }, [categories, items]);

  useEffect(() => {
    if (!user || user.id === 'mock_user') return;

    let isMounted = true;

    const loadLibrary = async () => {
      setIsLibraryLoading(true);
      setSyncMessage(null);

      const [categoryResult, itemResult] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, parent_id, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('items')
          .select('id, title, url, source_url, aspect, category_id, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (categoryResult.error || itemResult.error) {
        setSyncMessage('Database is not ready yet. Changes are saved locally on this device.');
        setIsLibraryLoading(false);
        return;
      }

      const loadedCategories = withRootCategory((categoryResult.data || []).map(toCategory));
      const loadedItems = (itemResult.data || []).map(toItem);

      setCategories(loadedCategories.length > 1 ? loadedCategories : INITIAL_CATEGORIES);
      setItems(loadedItems.length > 0 ? loadedItems : INITIAL_ITEMS);
      setActiveCategoryId(ROOT_CATEGORY_ID);
      setIsLibraryLoading(false);
    };

    loadLibrary();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Recursively get all child category IDs
  const getAllChildIds = (catId: string): string[] => {
    const children = categories.filter(c => c.parentId === catId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getAllChildIds(c.id)];
    });
    return ids;
  };

  const filteredItems = useMemo(() => {
    const targetIds = activeCategoryId === ROOT_CATEGORY_ID
      ? null
      : [activeCategoryId, ...getAllChildIds(activeCategoryId)];
    const scopedItems = targetIds
      ? items.filter(i => targetIds.includes(i.categoryId || ''))
      : items;
    const query = searchQuery.trim().toLowerCase();

    if (!query) return scopedItems;

    return scopedItems.filter((item) => {
      const categoryName = categories.find((category) => category.id === item.categoryId)?.name || 'Archive';
      return [item.title, item.url, item.sourceUrl, categoryName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [activeCategoryId, items, categories, searchQuery]);

  const breadcrumbs = useMemo(() => {
    const path: Category[] = [];
    let current = categories.find(c => c.id === activeCategoryId);
    while (current) {
      path.unshift(current);
      current = categories.find(c => c.id === current?.parentId);
    }
    return path;
  }, [activeCategoryId, categories]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSaving(true);

    const parentId = activeCategoryId === ROOT_CATEGORY_ID ? ROOT_CATEGORY_ID : activeCategoryId;
    const databaseParentId = isDatabaseId(parentId) ? parentId : null;
    const newCat: Category = { 
      id: crypto.randomUUID(), 
      name: newCatName.trim(), 
      parentId,
    };

    if (user && user.id !== 'mock_user') {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: newCat.name,
          parent_id: databaseParentId,
          user_id: user.id,
        })
        .select('id, name, parent_id, user_id')
        .single();

      if (error) {
        setSyncMessage('Could not sync the new folder. It was saved locally.');
      } else if (data) {
        newCat.id = data.id;
        newCat.parentId = data.parent_id ?? ROOT_CATEGORY_ID;
        setSyncMessage(null);
      }
    }

    setCategories((current) => [...current, newCat]);
    setNewCatName('');
    setIsCatModalOpen(false);
    setIsSaving(false);
  };

  const addItem = async () => {
    if (!newItemUrl.trim()) return;
    setIsSaving(true);

    const categoryId = isDatabaseId(activeCategoryId) ? activeCategoryId : null;
    const newItem: AestheticItem = {
      id: crypto.randomUUID(),
      url: newItemUrl.trim(),
      sourceUrl: newItemSourceUrl.trim() || undefined,
      title: newItemTitle.trim() || 'Untitled',
      categoryId,
      aspect: Math.random() > 0.6 ? 'portrait' : Math.random() > 0.3 ? 'square' : 'landscape'
    };

    if (user && user.id !== 'mock_user') {
      const { data, error } = await supabase
        .from('items')
        .insert({
          title: newItem.title,
          url: newItem.url,
          source_url: newItem.sourceUrl || null,
          aspect: newItem.aspect,
          category_id: newItem.categoryId,
          user_id: user.id,
        })
        .select('id, title, url, source_url, aspect, category_id, user_id')
        .single();

      if (error) {
        setSyncMessage('Could not sync the new asset. It was saved locally.');
      } else if (data) {
        newItem.id = data.id;
        setSyncMessage(null);
      }
    }

    setItems((current) => [newItem, ...current]);
    setNewItemUrl('');
    setNewItemSourceUrl('');
    setNewItemTitle('');
    setIsAddModalOpen(false);
    setIsSaving(false);
  };

  const deleteItem = async (itemId: string) => {
    const previousItems = items;
    setItems((current) => current.filter((item) => item.id !== itemId));

    if (!user || user.id === 'mock_user') return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      setItems(previousItems);
      setSyncMessage('Could not delete that asset from the database. Please try again.');
    } else {
      setSyncMessage(null);
    }
  };

  if (!user) {
    return <Auth onSuccess={setUser} />;
  }

  return (
    <div className="flex min-h-screen bg-bg text-fg font-sans selection:bg-fg selection:text-white">
      {/* Sidebar - Tree Navigation */}
      <motion.aside 
        animate={{ width: sidebarCollapsed ? 80 : 320 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="border-r border-gray-100 flex flex-col h-screen sticky top-0 bg-white/80 backdrop-blur-xl z-40 overflow-hidden"
      >
        <div className="p-8 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <h1 className="serif text-2xl italic font-medium tracking-tight">Aura Archive</h1>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          {!sidebarCollapsed && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 px-4 mb-4">Library Tree</p>
              <CategoryNode 
                categories={categories} 
                parentId={null} 
                activeId={activeCategoryId} 
                onSelect={setActiveCategoryId} 
                level={0}
              />
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex flex-col items-center gap-6 mt-4">
              <Home className={cn("w-6 h-6 cursor-pointer", activeCategoryId === ROOT_CATEGORY_ID ? "text-fg" : "text-gray-300")} onClick={() => setActiveCategoryId(ROOT_CATEGORY_ID)} />
              <Folder className="w-6 h-6 text-gray-300 hover:text-fg cursor-pointer" />
              <Plus className="w-6 h-6 text-gray-300 hover:text-fg cursor-pointer" onClick={() => setIsAddModalOpen(true)} />
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl mb-4">
              <div className="w-8 h-8 rounded-full bg-fg text-white flex items-center justify-center text-[10px] font-bold">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
              <button onClick={handleSignOut} className="text-gray-300 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={() => setIsCatModalOpen(true)}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-fg border border-gray-100 rounded-xl transition-all"
            >
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              disabled={isSaving}
              className="w-full bg-fg text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-black/5 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" /> Add Asset
            </button>
          </div>
        )}
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Breadcrumbs & Nav */}
        <header className="h-20 border-b border-gray-50 px-12 flex items-center justify-between sticky top-0 bg-bg/80 backdrop-blur-md z-30">
          <nav className="flex items-center gap-2 text-sm">
            <button onClick={() => setActiveCategoryId(ROOT_CATEGORY_ID)} className="text-gray-400 hover:text-fg transition-colors">Archive</button>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-gray-300" />
                <button 
                  onClick={() => setActiveCategoryId(crumb.id)}
                  className={cn(
                    "transition-colors",
                    idx === breadcrumbs.length - 1 ? "text-fg font-semibold" : "text-gray-400 hover:text-fg"
                  )}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </nav>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fg transition-colors" />
              <input 
                type="text" 
                placeholder="Search Archive..." 
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-full text-xs w-48 focus:w-64 focus:ring-1 focus:ring-fg transition-all outline-none"
              />
            </div>
          </div>
        </header>

        <section className="flex-1 p-12 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto">
            <header className="mb-12">
              <h2 className="serif text-6xl font-medium tracking-tight">
                {activeCategoryId === ROOT_CATEGORY_ID ? 'The Collective' : categories.find(c => c.id === activeCategoryId)?.name}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span>{filteredItems.length} assets</span>
                {isLibraryLoading && <span>Syncing library...</span>}
                {syncMessage && <span className="text-amber-600">{syncMessage}</span>}
              </div>
            </header>

            {/* Non-symmetric Masonry Layout */}
            <LayoutGroup>
              <div className="columns-2 md:columns-3 xl:columns-4 gap-8 space-y-8">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      className="break-inside-avoid group cursor-zoom-in"
                    >
                      <div 
                        onClick={() => item.sourceUrl && window.open(item.sourceUrl, '_blank')}
                        className={cn(
                          "relative overflow-hidden rounded-[2.5rem] bg-gray-50 transition-all duration-700 hover:shadow-2xl hover:shadow-black/10",
                          item.aspect === 'portrait' ? 'aspect-[3/4.5]' : item.aspect === 'square' ? 'aspect-square' : 'aspect-[1.4/1]'
                        )}
                      >
                        <img 
                          src={item.url} 
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-between p-8">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-widest text-white/60 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full">
                              {item.aspect}
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                              className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <p className="text-white font-medium text-xl leading-tight mb-2">{item.title}</p>
                            <div className="flex items-center gap-2">
                              <Folder className="w-3 h-3 text-white/40" />
                              <p className="text-white/60 text-[10px] uppercase tracking-[0.2em]">
                                {categories.find(c => c.id === item.categoryId)?.name || 'Archive'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </LayoutGroup>

            {filteredItems.length === 0 && (
              <div className="h-[50vh] flex flex-col items-center justify-center text-gray-200">
                <ImageIcon className="w-16 h-16 mb-6 opacity-20" />
                <p className="serif text-3xl italic">A void waiting for beauty.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(isCatModalOpen || isAddModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsCatModalOpen(false); setIsAddModalOpen(false); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden p-12"
            >
              <button 
                onClick={() => { setIsCatModalOpen(false); setIsAddModalOpen(false); }}
                className="absolute top-8 right-8 p-2 text-gray-300 hover:text-fg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {isCatModalOpen && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="serif text-4xl">New Collection</h3>
                    <p className="text-sm text-gray-400">Add a nested folder inside {categories.find(c => c.id === activeCategoryId)?.name || 'Archive'}</p>
                  </div>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Collection Name..."
                    className="w-full bg-gray-50 border-none p-6 rounded-2xl outline-none focus:ring-1 focus:ring-fg text-lg"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  />
                  <button 
                    onClick={addCategory}
                    disabled={isSaving}
                    className="w-full bg-fg text-white py-5 rounded-2xl font-bold tracking-widest uppercase text-xs hover:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Create Folder'}
                  </button>
                </div>
              )}

              {isAddModalOpen && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="serif text-4xl">Add to Archive</h3>
                    <p className="text-sm text-gray-400">Capturing aesthetic to {categories.find(c => c.id === activeCategoryId)?.name || 'Archive'}</p>
                  </div>
                  <div className="space-y-4">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Asset URL (Image link)"
                      className="w-full bg-gray-50 border-none p-6 rounded-2xl outline-none focus:ring-1 focus:ring-fg"
                      value={newItemUrl}
                      onChange={(e) => setNewItemUrl(e.target.value)}
                    />
                    <input 
                      type="text" 
                      placeholder="Source URL (Pinterest, etc.)"
                      className="w-full bg-gray-50 border-none p-6 rounded-2xl outline-none focus:ring-1 focus:ring-fg"
                      value={newItemSourceUrl}
                      onChange={(e) => setNewItemSourceUrl(e.target.value)}
                    />
                    <input 
                      type="text" 
                      placeholder="Visual Title"
                      className="w-full bg-gray-50 border-none p-6 rounded-2xl outline-none focus:ring-1 focus:ring-fg"
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                    />
                  </div>
                  <button 
                    onClick={addItem}
                    disabled={isSaving}
                    className="w-full bg-fg text-white py-5 rounded-2xl font-bold tracking-widest uppercase text-xs hover:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Preserve Aesthetic'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function CategoryNode({ categories, parentId, activeId, onSelect, level }: { 
  categories: Category[], 
  parentId: string | null, 
  activeId: string, 
  onSelect: (id: string) => void,
  level: number
}) {
  const nodes = categories.filter(c => c.parentId === parentId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'all': true, '1': true, '2': true });

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-0.5">
      {nodes.map(node => {
        const hasChildren = categories.some(c => c.parentId === node.id);
        const isActive = activeId === node.id;
        const isExpanded = expanded[node.id];

        return (
          <div key={node.id}>
            <button
              onClick={() => onSelect(node.id)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 rounded-xl transition-all group",
                isActive ? "bg-fg text-white shadow-lg" : "text-gray-500 hover:bg-gray-50 hover:text-fg"
              )}
              style={{ paddingLeft: `${level * 16 + 16}px` }}
            >
              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                {hasChildren ? (
                  <ChevronDown 
                    className={cn("w-4 h-4 shrink-0 transition-transform", !isExpanded && "-rotate-90")} 
                    onClick={(e) => toggle(node.id, e)}
                  />
                ) : (
                  <div className="w-4 h-4 shrink-0" />
                )}
                {node.id === 'all' ? <Home className="w-4 h-4" /> : <Folder className={cn("w-4 h-4", isActive ? "text-white/50" : "text-gray-300")} />}
                <span className="text-sm font-medium truncate">{node.name}</span>
              </div>
            </button>
            {hasChildren && isExpanded && (
              <CategoryNode 
                categories={categories} 
                parentId={node.id} 
                activeId={activeId} 
                onSelect={onSelect} 
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
