import type { Metadata } from 'next';

// O token vai na URL: não repassar a página como Referer para terceiros.
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default function ResetPasswordTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
