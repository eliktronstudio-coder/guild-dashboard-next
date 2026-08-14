import { Image as ImageIcon, Video } from "lucide-react";

const items = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  kind: i % 3 === 0 ? "video" : "image",
  title: i % 3 === 0 ? `Запись рейда #${i + 1}` : `Скриншот #${i + 1}`,
}));

export default function MediaPage() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface text-muted"
        >
          {item.kind === "video" ? <Video size={22} /> : <ImageIcon size={22} />}
          <span className="px-2 text-center text-xs">{item.title}</span>
        </div>
      ))}
    </div>
  );
}
