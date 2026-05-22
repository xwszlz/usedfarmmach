"use client";

import { Carousel, CarouselItem } from "@/components/ui/carousel";
import type { ProductImage } from "@/types";

interface ProductCarouselProps {
  images: ProductImage[];
  alt: string;
}

export function ProductCarousel({ images, alt }: ProductCarouselProps) {
  if (images.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg bg-gray-100">
        <span className="text-gray-400">No images</span>
      </div>
    );
  }

  return (
    <Carousel className="w-full">
      {images.map((image) => (
        <CarouselItem key={image.id}>
          <div className="h-96 overflow-hidden rounded-lg bg-gray-100">
            <img
              src={image.url}
              alt={alt}
              className="h-full w-full object-cover"
            />
          </div>
        </CarouselItem>
      ))}
    </Carousel>
  );
}
