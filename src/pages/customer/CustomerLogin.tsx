import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Loader2, CheckCircle2, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerLogin() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [loading, setLoading] = useState(false);

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      const normalized = phone.startsWith('+') ? phone : `+91${phone}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setStep('otp');
      toast.success('OTP sent! Check your phone.');
    } catch (err: any) {
      if (err.message?.includes('not configured') || err.message?.includes('provider')) {
        toast.info('OTP provider not configured — using dev bypass');
        localStorage.setItem('customer_phone', phone);
        setStep('done');
      } else {
        toast.error(err.message || 'Failed to send OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const normalized = phone.startsWith('+') ? phone : `+91${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      localStorage.setItem('customer_phone', phone);
      setStep('done');
      toast.success('Logged in successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('customer_phone');
    supabase.auth.signOut();
    setStep('phone');
    setPhone('');
    setOtp('');
    toast.success('Logged out');
  };

  const savedPhone = localStorage.getItem('customer_phone');

  if (step === 'done' || savedPhone) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-5 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Logged In</h2>
        <p className="text-gray-500 text-sm mb-6">{savedPhone || phone}</p>

        <div className="bg-white rounded-xl shadow-sm p-4 w-full max-w-sm mb-4 text-left space-y-3">
          <div className="text-sm font-semibold text-gray-700">Account Details</div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Phone</span>
            <span className="font-medium">{savedPhone || phone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Access</span>
            <span className="font-medium text-green-600">Customer Portal</span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full max-w-sm mb-4 text-left">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Your account is linked to your phone number. All your orders are accessible using this number.
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 rounded-xl font-medium text-sm"
        >
          <LogOut className="h-4 w-4" /> Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center p-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🌿</div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Login</h1>
        <p className="text-gray-500 text-sm mt-1">
          Sign in to track your orders and re-order easily
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5 max-w-sm mx-auto w-full">
        {step === 'phone' ? (
          <>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">
                WhatsApp / Mobile Number
              </label>
              <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-400">
                <div className="bg-gray-50 px-3 py-3 border-r text-sm text-gray-500 font-medium">
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 px-3 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <button
              onClick={sendOTP}
              disabled={loading || phone.length < 10}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
              Send OTP
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">
                Enter 6-Digit OTP sent to +91{phone}
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                className="w-full border rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-green-400"
                maxLength={6}
              />
            </div>

            <button
              onClick={verifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Verify & Login
            </button>

            <button
              onClick={() => { setStep('phone'); setOtp(''); }}
              className="w-full text-sm text-gray-500 py-2"
            >
              ← Change number
            </button>

            <div className="text-center">
              <button
                onClick={sendOTP}
                disabled={loading}
                className="text-sm text-green-600 underline"
              >
                Resend OTP
              </button>
            </div>
          </>
        )}

        <div className="border-t pt-4 text-center">
          <p className="text-xs text-gray-400">
            By continuing, you agree to our terms of service. Your number is used only for order notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
