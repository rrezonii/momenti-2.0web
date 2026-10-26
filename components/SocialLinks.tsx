const socialNetworks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/GazetaMomenti",
    path: "M13.4 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.2V13H10v8h3.4Z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@MomentiMedia",
    path: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/momenti.info/",
    path: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7Zm5 3.1a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 2.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm5-3.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@momenti_media",
    path: "M19.6 6.2a5.4 5.4 0 0 1-3.4-3.5V2h-3.7v13.7a2.8 2.8 0 1 1-2.8-2.8c.4 0 .8.1 1.1.2V9.3a6.5 6.5 0 1 0 5.4 6.4V9a9 9 0 0 0 5.2 1.7V7a5.3 5.3 0 0 1-1.8-.8Z",
  },
];

export default function SocialLinks({ className }: { className: string }) {
  return (
    <div className={className} aria-label="Rrjetet sociale të Momenti">
      {socialNetworks.map((network) => (
        <a
          key={network.name}
          href={network.href}
          aria-label={network.name}
          title={network.name}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={network.path} fill="currentColor" />
          </svg>
        </a>
      ))}
    </div>
  );
}
