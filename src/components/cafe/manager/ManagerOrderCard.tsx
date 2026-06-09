import { format } from 'date-fns';
import { ShoppingCart, User, CheckCircle2, XCircle, Eye, CreditCard, Clock, Image as ImageIcon, Package, MessageSquare, Star } from 'lucide-react';
import { CafeOrder } from '@/hooks/useCafeOrders';

interface ManagerOrderCardProps {
  order: CafeOrder;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onReady: (id: string) => void;
  onCollected: (id: string) => void;
  onViewProof: (url: string) => void;
  onViewItems: (order: CafeOrder) => void;
  isVerifying?: boolean;
}

export function ManagerOrderCard({ 
  order, 
  onVerify, 
  onReject, 
  onReady, 
  onCollected, 
  onViewProof, 
  onViewItems,
  isVerifying 
}: ManagerOrderCardProps) {
  // Trusted orders skip payment verification — don't show verify/reject UI for them
  const isAwaitingVerification = (order.payment_status === 'proof_uploaded' || order.payment_status === 'pending_proof') && !order.trusted_order;
  const isPreparing = order.order_status === 'preparing';
  const isReady = order.order_status === 'ready';

  return (
    <div className="group relative bg-white/[0.02] backdrop-blur-3xl rounded-[22px] border border-white/5 hover:border-primary/30 shadow-lg transition-all duration-500 overflow-hidden flex flex-col h-full hover:bg-white/[0.04] selection:bg-primary/20">
      <div className="p-3.5 flex-1 space-y-3">
        {/* Header: Number & Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform duration-500">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.1em] leading-none mb-0.5 opacity-40">Order</span>
              <span className="font-black text-xl tracking-tighter text-white uppercase leading-none">#{order.order_number}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{order.order_time}</span>
          </div>
        </div>

        {/* Special Instructions Banner - Prominent */}
        {order.special_instructions && (
          <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 shadow-[inset_0_0_20px_rgba(245,158,11,0.03)] relative overflow-hidden group/note">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/note:scale-125 transition-transform duration-700">
              <MessageSquare className="w-10 h-10 text-amber-400" />
            </div>
            <div className="relative flex items-start gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.1em]">Note</span>
                </div>
                <p className="text-[11px] font-black text-white/90 leading-tight tracking-tight uppercase italic drop-shadow-sm">
                  "{order.special_instructions}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:bg-white/[0.05] transition-all duration-500">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-xs text-white truncate uppercase tracking-tight leading-none mb-1">{order.customer_name || 'Guest'}</p>
            <p className="text-[9px] font-bold text-muted-foreground truncate uppercase tracking-[0.1em] leading-none opacity-40">{order.customer_department || 'General'}</p>
          </div>
        </div>

        {/* Customer Review (Visible if rated) */}
        {order.rating && (
          <div className="p-4 rounded-2xl bg-yellow-500/5 border-2 border-yellow-500/20 shadow-[inset_0_0_15px_rgba(234,179,8,0.05)] animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < order.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/20'}`} />
                ))}
              </div>
              <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">{order.rating}/5 Rating</span>
            </div>
            {order.feedback && (
              <p className="text-xs font-semibold text-foreground leading-relaxed italic">"{order.feedback}"</p>
            )}
          </div>
        )}

        {/* Items List - Compact Summary */}
        {order.cafe_order_items && order.cafe_order_items.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
            <div className="flex items-center gap-2 mb-1 px-1">
              <Package className="w-3 h-3 text-muted-foreground opacity-40" />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Order Content</span>
            </div>
            <div className="space-y-2.5">
              {order.cafe_order_items.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-black text-foreground uppercase tracking-tight leading-none truncate">
                      {item.item_name}
                    </p>
                    <span className="text-[10px] font-bold text-muted-foreground shrink-0">x{item.quantity}</span>
                  </div>
                  {item.special_request && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/5 border border-orange-500/10 max-w-fit">
                      <MessageSquare className="w-2.5 h-2.5 text-orange-400" />
                      <p className="text-[9px] font-medium text-orange-400 italic">"{item.special_request}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions per Status */}
        <div className="space-y-3">
          {isAwaitingVerification && (
            <div className="space-y-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Verify Payment</span>
                 <CreditCard className="w-4 h-4 text-blue-500 opacity-40" />
               </div>
               
               <div className="grid grid-cols-2 gap-2">
                 <button
                   onClick={() => onVerify(order.id)}
                   disabled={isVerifying}
                   className="py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                 >
                   <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                 </button>
                 <button
                   onClick={() => onReject(order.id)}
                   className="py-3 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                 >
                   <XCircle className="w-3.5 h-3.5" /> Reject
                 </button>
               </div>

               {order.payment_proof_url && (
                 <button 
                   onClick={() => onViewProof(order.payment_proof_url!)}
                   className="w-full py-2.5 mt-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase text-blue-400 border border-blue-400/20 transition-all flex items-center justify-center gap-2"
                 >
                   <ImageIcon className="w-3.5 h-3.5" /> View Receipt
                 </button>
               )}
            </div>
          )}

          {isPreparing && (
             <button
               onClick={() => onReady(order.id)}
               className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               Mark Ready <CheckCircle2 className="w-4 h-4" />
             </button>
          )}

          {isReady && (
             <button
               onClick={() => onCollected(order.id)}
               className="w-full py-4 rounded-2xl bg-foreground text-background text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-foreground/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               Confirm Collection <Package className="w-4 h-4" />
             </button>
          )}

          {order.order_status === 'pending_payment' && !isAwaitingVerification && (
             <div className="p-3 text-center rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Waiting for payment proof</p>
             </div>
          )}
        </div>
      </div>

      {/* Footer Summary */}
      <div className="p-3 bg-muted/30 border-t border-primary/5 space-y-2 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-tight">Grand Total</span>
            <span className="text-sm font-black text-foreground leading-none">₹{order.total_amount}</span>
          </div>
          <button
            onClick={() => onViewItems(order)}
            className="px-3 py-1.5 rounded-xl bg-background border border-primary/10 hover:border-primary/40 text-[9px] font-black uppercase tracking-widest text-primary transition-all flex items-center gap-2 relative"
          >
            {order.rating && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border-2 border-background animate-pulse" title="Rated" />
            )}
            Details <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
