import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from './CustomerPortal';
import { Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Leafy Greens', 'Root Vegetables', 'Exotic Vegetables', 'Herbs & Spices'];

const GRADE_INFO = {
  A: { label: 'Grade A', desc: 'Premium quality', color: 'bg-green-100 text-green-700', border: 'border-green-300' },
  B: { label: 'Grade B', desc: 'Good quality',    color: 'bg-blue-100 text-blue-700',   border: 'border-blue-300'  },
  C: { label: 'Grade C', desc: 'Value pack',       color: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
};

export default function CustomerHome() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState<'A' | 'B' | 'C'>('A');
  const { addItem } = useCart();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['customer-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, unit, grade_a_price, grade_b_discount, grade_c_discount, description')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  const getPrice = (p: any, grade: 'A' | 'B' | 'C') => {
    const disc = grade === 'A' ? 0 : grade === 'B' ? p.grade_b_discount : p.grade_c_discount;
    return parseFloat((p.grade_a_price * (1 - disc / 100)).toFixed(2));
  };

  const handleAddToCart = (product: any) => {
    const price = getPrice(product, selectedGrade);
    addItem({
      product_id: product.id,
      product_name: product.name,
      grade: selectedGrade,
      unit_price: price,
      qty: 1,
      unit: product.unit || 'kg',
    });
    toast.success(`${product.name} (Grade ${selectedGrade}) added to cart`);
  };

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-green-700 to-green-500 text-white px-4 pt-4 pb-8">
        <h2 className="text-xl font-bold mb-1">Fresh Vegetables & Fruits</h2>
        <p className="text-green-100 text-sm mb-4">Direct from farms, delivered to your shop</p>
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tomato, onion, carrot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-gray-800 outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="bg-white px-4 py-3 border-b -mt-4 rounded-t-2xl">
        <div className="text-xs text-gray-500 font-medium mb-2">Select Grade</div>
        <div className="grid grid-cols-3 gap-2">
          {(['A', 'B', 'C'] as const).map((g) => {
            const info = GRADE_INFO[g];
            return (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`border-2 rounded-xl py-2 px-3 text-left transition-all ${
                  selectedGrade === g ? `${info.border} ${info.color}` : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                <div className="text-xs font-bold">{info.label}</div>
                <div className="text-xs opacity-70">{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border-b overflow-x-auto">
        <div className="flex gap-0 px-4 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                category === cat ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => {
              const price = getPrice(product, selectedGrade);
              const gradeInfo = GRADE_INFO[selectedGrade];
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                    <span className="text-3xl">🥬</span>
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</div>
                    <div className={`inline-flex text-xs px-1.5 py-0.5 rounded mt-1 ${gradeInfo.color}`}>
                      {gradeInfo.label}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <div className="text-base font-bold text-green-700">₹{price}/{product.unit || 'kg'}</div>
                        {selectedGrade !== 'A' && (
                          <div className="text-xs text-gray-400 line-through">₹{product.grade_a_price}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-transform"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
