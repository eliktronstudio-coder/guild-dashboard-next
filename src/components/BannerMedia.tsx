import Image from "next/image";

/** Баннеры хранятся как data: URL — по префиксу отличаем видео от картинки/GIF. */
export function isVideoBannerSrc(src: string) {
  return src.startsWith("data:video/");
}

type Props = {
  src: string;
  alt?: string;
  className?: string;
  sizes?: string;
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

/**
 * MP4-баннеры проигрываются беззвучно и зациклены, как GIF — это фон
 * карточки, а не видео с управлением, поэтому убраны controls и звук.
 */
export default function BannerMedia({ src, alt = "", className, sizes, fill, width, height }: Props) {
  if (isVideoBannerSrc(src)) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className={fill ? `absolute inset-0 h-full w-full ${className ?? ""}` : className}
      />
    );
  }
  if (fill) {
    return <Image src={src} alt={alt} fill sizes={sizes} unoptimized className={className} />;
  }
  return <Image src={src} alt={alt} width={width} height={height} unoptimized className={className} />;
}
