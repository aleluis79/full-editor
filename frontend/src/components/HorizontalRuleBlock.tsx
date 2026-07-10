import type { HorizontalRule as HorizontalRuleType } from '../core/types';

interface HorizontalRuleProps {
  block: HorizontalRuleType;
}

export function HorizontalRuleBlock({ block }: HorizontalRuleProps) {
  return <hr className="horizontal-rule" data-block-id={block.id} />;
}
