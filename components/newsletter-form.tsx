"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { LuxuryMark } from '@/components/luxury-mark';

interface Subscriber {
  id: string;
  email: string;
  createdAt: string;
}

export default function NewsletterForm() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchSubscribers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/newsletter/subscribers');
        if (response.ok) {
          const data = await response.json();
          setSubscribers(data);
        } else {
          toast({
            title: "Error",
            description: "Could not load subscribers.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "An unexpected error occurred while fetching subscribers.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubscribers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    
    try {
      const response = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Newsletter Sent!",
          description: "Your newsletter has been sent to your subscribers.",
        });
        setSubject('');
        setContent('');
      } else {
        throw new Error(result.error || 'An unknown error occurred');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send the newsletter. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-3xl rounded-3xl border border-stone-200 bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="Newsletter Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-2xl border-stone-200"
            required
          />
        </div>
        <div>
          <Textarea
            placeholder="Write your newsletter content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px] rounded-2xl border-stone-200"
            required
          />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-stone-500">
            {isLoading ? <LuxuryMark size="button" /> : `${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"}`}
          </p>
          <Button type="submit" disabled={!subject || !content || subscribers.length === 0 || isSending} className="rounded-full bg-black text-white hover:bg-black/80">
            {isSending ? 'Sending...' : 'Send Newsletter'}
          </Button>
        </div>
      </form>
    </div>
  );
} 