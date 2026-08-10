import { getGritColor } from '@/lib/grit-colors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  description?: string | null;
  /** Show the colour name next to the swatch */
  withLabel?: boolean;
  className?: string;
}

/** Colour chip representing the grit/colour code of a Noga UF item. */
export const GritColorBadge = ({ description, withLabel = false, className = '' }: Props) => {
  const grit = getGritColor(description);
  if (!grit) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
          <span
            aria-label={`${grit.name} grit`}
            className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
            style={{ backgroundColor: grit.hex }}
          />
          {withLabel && <span className="text-xs text-muted-foreground">{grit.name}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {grit.name} ({grit.code})
      </TooltipContent>
    </Tooltip>
  );
};

export default GritColorBadge;
