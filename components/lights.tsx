import { cn } from "@/lib/utils";

export const Lights = ({ children }: { children: React.ReactNode }) => {
  const debug = false;

  return (
    <>
      <div className="absolute inset-0">
        <div className={cn("absolute bottom-2/6 right-1/6 translate-x-1/2 translate-y-1/2 size-96 text-background-blob animate-blob-1", debug && "bg-red-500/50")}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M34.6,-64.7C44.3,-54.2,51.3,-43.9,52.2,-33.2C53.2,-22.4,48.2,-11.2,46.9,-0.8C45.6,9.7,48,19.4,46.6,29.5C45.2,39.6,40.1,50,31.7,54.9C23.3,59.7,11.6,58.9,2,55.4C-7.6,51.9,-15.2,45.7,-28.3,43.6C-41.3,41.4,-59.9,43.3,-68.5,36.8C-77.1,30.2,-75.7,15.1,-70.9,2.8C-66.2,-9.5,-57.9,-19.1,-53.7,-33.4C-49.6,-47.7,-49.5,-66.7,-41.3,-78C-33,-89.3,-16.5,-92.9,-2,-89.4C12.4,-85.8,24.8,-75.2,34.6,-64.7Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        <div className={cn("absolute top-2/6 right-1/6 translate-x-1/2 -translate-y-1/2 size-96 text-background-blob animate-blob-2", debug && "bg-red-500/50")}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M37.6,-68.3C48.2,-59.1,55.8,-47.9,64.7,-36.1C73.6,-24.4,83.8,-12.2,82.8,-0.5C81.9,11.1,69.8,22.2,61,34.2C52.3,46.1,46.8,58.8,37.2,67.2C27.5,75.6,13.8,79.6,0.3,79C-13.1,78.5,-26.2,73.3,-37,65.5C-47.7,57.8,-56.2,47.5,-57.3,36.2C-58.3,24.9,-52.1,12.4,-48.1,2.3C-44,-7.8,-42.2,-15.6,-37.6,-20.8C-32.9,-26,-25.5,-28.6,-18.8,-40C-12,-51.5,-6,-71.7,3.8,-78.2C13.5,-84.7,27.1,-77.5,37.6,-68.3Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        <div className={cn("absolute bottom-2/6 left-1/6 -translate-x-1/2 translate-y-1/2 size-96 text-background-blob animate-blob-3", debug && "bg-red-500/50")}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M26.5,-44.1C32.3,-42.5,33.7,-31.4,40,-22.5C46.3,-13.5,57.5,-6.8,64,3.7C70.5,14.2,72.2,28.5,67.1,39.5C62,50.5,50,58.2,37.7,65.6C25.4,73.1,12.7,80.2,-0.5,81.1C-13.7,82,-27.4,76.6,-39.5,69C-51.5,61.4,-61.9,51.6,-63.9,39.7C-65.9,27.8,-59.6,13.9,-59.4,0.1C-59.2,-13.7,-65.1,-27.3,-62.8,-38.8C-60.5,-50.2,-50.1,-59.4,-38.3,-57.6C-26.4,-55.7,-13.2,-42.8,-1.5,-40.2C10.3,-37.7,20.6,-45.7,26.5,-44.1Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        
        <div className={cn("absolute top-2/6 left-1/6 -translate-x-1/2 -translate-y-1/2 size-96 text-background-blob animate-blob-4", debug && "bg-red-500/50")}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M34.6,-64.7C44.3,-54.2,51.3,-43.9,52.2,-33.2C53.2,-22.4,48.2,-11.2,46.9,-0.8C45.6,9.7,48,19.4,46.6,29.5C45.2,39.6,40.1,50,31.7,54.9C23.3,59.7,11.6,58.9,2,55.4C-7.6,51.9,-15.2,45.7,-28.3,43.6C-41.3,41.4,-59.9,43.3,-68.5,36.8C-77.1,30.2,-75.7,15.1,-70.9,2.8C-66.2,-9.5,-57.9,-19.1,-53.7,-33.4C-49.6,-47.7,-49.5,-66.7,-41.3,-78C-33,-89.3,-16.5,-92.9,-2,-89.4C12.4,-85.8,24.8,-75.2,34.6,-64.7Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        {/* Dead center */}
        <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-full w-[60%] max-w-[450px] text-background-blob animate-center-blob", debug && "bg-red-500/50")}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M39.3,-67.3C51.1,-61.3,60.8,-51,67.6,-39.1C74.4,-27.2,78.2,-13.6,75,-1.8C71.9,9.9,61.8,19.9,56,33.6C50.3,47.3,48.9,64.8,40.3,73.2C31.6,81.6,15.8,81,1.8,77.9C-12.2,74.8,-24.5,69.2,-37.4,63.3C-50.2,57.3,-63.7,50.9,-73.3,40.3C-83,29.7,-88.9,14.8,-87.5,0.8C-86.1,-13.2,-77.4,-26.4,-66.2,-34.5C-55.1,-42.5,-41.5,-45.4,-30,-51.5C-18.6,-57.7,-9.3,-67.1,2.2,-71C13.8,-74.9,27.5,-73.2,39.3,-67.3Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        {/* Backdrop filter overlay */}
        <div className="fixed inset-0 backdrop-blur-[150px]" />
      </div>
      {children}
    </>
  );
};
