import { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  department: string;
  role: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  onEnter?: () => void;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Add a comment... (use @name to mention someone)",
  className,
  rows = 2,
  disabled = false,
  onEnter,
}: MentionInputProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, department, role')
        .eq('is_active', true)
        .order('name');
      setUsers(data || []);
    };
    fetchUsers();
  }, []);

  // Filter users based on mention query
  useEffect(() => {
    if (mentionQuery) {
      const query = mentionQuery.toLowerCase();
      const filtered = users.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.department.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
      ).slice(0, 8);
      setFilteredUsers(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredUsers(users.slice(0, 8));
      setSelectedIndex(0);
    }
  }, [mentionQuery, users]);

  // Detect @ and show suggestions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;

    onChange(newValue);
    setCursorPosition(cursor);

    // Find if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter') {
      if (showSuggestions) {
        e.preventDefault();
        selectUser(filteredUsers[selectedIndex]);
      } else if (onEnter && !e.shiftKey) {
        e.preventDefault();
        onEnter();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Insert selected user mention
  const selectUser = useCallback((user: User) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    // Find the @ position
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const atPosition = textBeforeCursor.lastIndexOf('@');
      const newText = textBeforeCursor.slice(0, atPosition) + '@' + user.name + ' ' + textAfterCursor;
      onChange(newText);
    }

    setShowSuggestions(false);
    setMentionQuery('');

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [value, cursorPosition, onChange]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("resize-none", className)}
        rows={rows}
        disabled={disabled}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full bottom-full mb-1 max-h-40 overflow-auto bg-popover border border-white/10 rounded-lg shadow-2xl backdrop-blur-xl bg-opacity-90"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={cn(
                "w-full px-3 py-2 text-left flex items-center justify-between hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
            >
              <div>
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({user.role})
                </span>
              </div>
              <span className="text-xs text-muted-foreground capitalize">
                {user.department}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
