export type SeasonGapTierKey="unknown"|"none"|"micro"|"small"|"medium"|"large";

export type SeasonGapTier={key:SeasonGapTierKey;label:string;multiplier:number;gapPoints:number;missingSeasons:number;partialSeasons:number};
export type PackageTierKey="few"|"medium"|"many"|"hundred";
export type PackageTier={key:PackageTierKey;label:string;premium:number};

export const vintageNoBreakAnchors:Record<string,number>={
  gratitude:180000,
  lightseekers:140000,
  belonging:70000,
  rhythm:50000,
  enchantment:12000,
  sanctuary:10000,
  prophecy:8000,
  dreams:6500,
  assembly:5000,
  "the-little-prince":4000,
  flight:3400,
  abyss:3000,
  performance:2500,
  shattering:2300,
  aurora:2200,
  remembrance:2100,
  passage:2000,
  moments:1900,
  revival:1800,
  "nine-colored-deer":1700,
  nesting:1600,
  duets:1500,
  moomin:1400
};

const seasonGapValues:Record<string,number>={
  gratitude:40000,
  lightseekers:70000,
  belonging:20000,
  rhythm:38000,
  enchantment:2000,
  sanctuary:2000,
  prophecy:1500,
  dreams:1500,
  assembly:1000,
  "the-little-prince":1000,
  flight:700,
  abyss:700,
  performance:500,
  shattering:400,
  aurora:400,
  remembrance:350,
  passage:350,
  moments:300,
  revival:300,
  "nine-colored-deer":250,
  nesting:250,
  duets:200,
  moomin:200,
  radiance:180,
  "blue-bird":160,
  "two-embers-part-1":140,
  lightmending:120,
  migration:100,
  carnival:100,
  "dear-van-gogh":100
};

export const classifySeasonGap=(input:{hasSeasonData:boolean;missingSeasons:number;partialSeasons:number}):SeasonGapTier=>{
  if(!input.hasSeasonData)return{key:"unknown",label:"尚未判定",multiplier:1,gapPoints:0,missingSeasons:0,partialSeasons:0};
  const gapPoints=input.missingSeasons+input.partialSeasons*.5;
  const common={gapPoints,missingSeasons:input.missingSeasons,partialSeasons:input.partialSeasons};
  if(gapPoints===0)return{key:"none",label:"無斷",multiplier:1,...common};
  if(gapPoints<=1)return{key:"micro",label:"微斷",multiplier:.98,...common};
  if(gapPoints<=3)return{key:"small",label:"小斷",multiplier:.94,...common};
  if(gapPoints<=6)return{key:"medium",label:"中斷",multiplier:.86,...common};
  return{key:"large",label:"大斷",multiplier:.72,...common};
};

export const classifyPackageTier=(count:number):PackageTier=>{
  if(count>=100)return{key:"hundred",label:"百禮",premium:23000+Math.min(count-100,50)*180};
  if(count>=40)return{key:"many",label:"多禮",premium:8000+(count-40)*250};
  if(count>=15)return{key:"medium",label:"中禮",premium:2500+(count-15)*150};
  return{key:"few",label:"少禮",premium:count*80};
};

export const calibrateHighValueEstimate=(input:{statisticalEstimate:number;earliestSeasonSlug:string|null;startEvidenceConfidence:number;ultimateCount:number;collaborationCount:number;gapTier:SeasonGapTier;packageTier:PackageTier;missingSeasonSlugs:string[];partialSeasonSlugs:string[]})=>{
  const anchor=input.earliestSeasonSlug?vintageNoBreakAnchors[input.earliestSeasonSlug]||0:0;
  if(!anchor)return input.statisticalEstimate+input.packageTier.premium*.25;
  const vintageScale=anchor>=100000?1:anchor>=50000?.8:anchor>=10000?.5:.25;
  const missingValue=input.missingSeasonSlugs.reduce((sum,slug)=>sum+(seasonGapValues[slug]||100),0);
  const partialValue=input.partialSeasonSlugs.reduce((sum,slug)=>sum+(seasonGapValues[slug]||100)*.5,0);
  const seasonValue=Math.max(anchor*.22,(anchor-missingValue-partialValue)*input.gapTier.multiplier);
  const packageValue=input.packageTier.premium*vintageScale;
  const collaborationValue=Math.min(input.collaborationCount*500,12000)*vintageScale;
  const completionValue=Math.max(0,input.ultimateCount-60)*500;
  const marketEstimate=seasonValue+packageValue+collaborationValue+completionValue;
  const confidence=Math.max(0,Math.min(1,input.startEvidenceConfidence));
  const blendedEstimate=input.statisticalEstimate*(1-confidence)+marketEstimate*confidence;
  return Math.max(input.statisticalEstimate*.65,blendedEstimate);
};
