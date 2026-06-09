import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, Star, Users } from 'lucide-react';

interface RatingListProps {
  items: any[];
}

export function RatingList({ items }: RatingListProps) {
  // Fetch all feedbacks to match with dishes
  const { data: recentFeedbacks, isLoading: feedbacksLoading } = useQuery({
    queryKey: ['cafe-all-feedbacks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .select('id, rating, feedback, rated_at, cafe_order_items(item_name, menu_item_id)')
        .not('feedback', 'is', null)
        .order('rated_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const displayItems = items.map(item => ({
    ...item,
    average_rating: item.average_rating || 0,
    review_count: item.review_count || 0
  })).sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 flex items-center justify-center border border-yellow-500/30">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase tracking-[0.05em]">Dish Performance</h2>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse" />
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none">
                Real-time Customer Insights
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5">
          <Users className="w-4 h-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Insights</span>
            <span className="text-sm font-black text-white leading-none">{displayItems.reduce((acc, i) => acc + i.review_count, 0)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayItems.map(item => (
          <div key={item.id} className="group relative bg-white/[0.02] backdrop-blur-3xl rounded-[32px] border border-white/5 hover:border-primary/30 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 overflow-hidden flex flex-col hover:bg-white/[0.04]">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={item.item_image_url || '/placeholder.png'} 
                      className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-xl group-hover:scale-110 transition-transform duration-700" 
                      alt="" 
                    />
                    <div className="absolute -top-1 -right-1">
                      {item.average_rating >= 4.5 ? (
                         <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 text-white border border-white/20">
                            <Star className="w-3.5 h-3.5 fill-white" />
                         </div>
                      ) : item.average_rating >= 4.0 && (
                        <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40 text-white border border-white/20">
                           <Star className="w-3.5 h-3.5 fill-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-lg text-white uppercase tracking-tight leading-none mb-1 truncate">{item.item_name}</p>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">{item.category}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-xl font-black text-white">{Number(item.average_rating || 0).toFixed(1)}</span>
                  </div>
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40 leading-none">{item.review_count} Reviews</p>
                </div>
              </div>

              {/* Latest Feedback Section */}
              <div className="relative p-5 rounded-3xl bg-white/[0.03] border border-white/5 min-h-[100px] flex flex-col justify-center overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                  <MessageSquare className="w-16 h-16 text-white" />
                </div>
                {feedbacksLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/20 mx-auto" />
                ) : (
                  (() => {
                    const feedback = recentFeedbacks?.find(f => {
                      const orderItems = (f.cafe_order_items as any[]) || [];
                      return orderItems.some(oi => oi.item_name === item.item_name);
                    });
                    return feedback ? (
                      <div className="relative space-y-3">
                        <p className="text-xs font-medium text-white/80 leading-relaxed italic line-clamp-3 uppercase tracking-tight">
                          "{feedback.feedback}"
                        </p>
                        <div className="flex items-center gap-2 opacity-30">
                          <div className="w-1 h-1 rounded-full bg-white" />
                          <span className="text-[8px] font-black uppercase tracking-widest">
                            {feedback.rated_at ? new Date(feedback.rated_at).toLocaleDateString() : 'Recent Activity'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <span className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.2em]">Pending Insights</span>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40 leading-none mb-1">Catalog Pricing</span>
                  <span className="text-base font-black text-white">₹{item.price}</span>
                </div>
                {item.average_rating >= 4.5 ? (
                  <div className="px-4 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.1)]">Elite Performer</div>
                ) : item.average_rating >= 4.0 ? (
                  <div className="px-4 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest">Highly Rated</div>
                ) : item.average_rating <= 3.0 && item.review_count > 0 ? (
                  <div className="px-4 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest animate-pulse">Review Needed</div>
                ) : (
                  <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/5 text-muted-foreground text-[9px] font-black uppercase tracking-widest">Initial Data</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
