'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

type PendingAction = 'contact' | 'save' | null;

const COPY = {
  contact: {
    icon: '💬',
    title: 'Messaging is coming soon',
    description:
      'Buyer–seller messaging is not part of this build. In a full version this would open a conversation with the seller, with the listing attached for context.',
  },
  save: {
    icon: '🔖',
    title: 'Saved listings are coming soon',
    description:
      'Saving requires a signed-in account, and this build runs without authentication. In a full version this would add the listing to your saved items.',
  },
} as const;

/**
 * Buyer actions on the product detail page.
 *
 * Both features are out of scope for this build — they depend on authentication
 * and messaging, neither of which exists here. Rather than dead `href="#"` links
 * that appear broken, each explains what it would do and why it is not wired up.
 *
 * A Client Component so the PDP itself can stay a Server Component; only this
 * small island ships JavaScript.
 */
export function ListingActions({ sellerName }: { sellerName: string }) {
  const [pending, setPending] = useState<PendingAction>(null);
  const copy = pending ? COPY[pending] : null;

  return (
    <>
      <div className="mt-6 flex gap-3">
        <Button type="button" size="lg" className="flex-1" onClick={() => setPending('contact')}>
          Contact seller
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => setPending('save')}>
          Save
        </Button>
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        icon={copy?.icon}
        title={copy?.title ?? ''}
        description={copy?.description}
        footer={
          <Button type="button" onClick={() => setPending(null)}>
            Got it
          </Button>
        }
      >
        {pending === 'contact' ? (
          <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">
            This listing was posted by <span className="font-medium text-foreground">{sellerName}</span>.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
