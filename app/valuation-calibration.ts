export const vintageNoBreakAnchors:Record<string,number>={
  gratitude:180000,
  lightseekers:140000,
  belonging:95000,
  rhythm:70000,
  enchantment:42000,
  sanctuary:35000,
  prophecy:28000,
  dreams:22000,
  assembly:18000,
  "the-little-prince":13000,
  flight:11000,
  abyss:9500,
  performance:8000,
  shattering:7200,
  aurora:6500,
  remembrance:5800,
  passage:5200,
  moments:4800,
  revival:4500,
  "nine-colored-deer":4200,
  nesting:3900,
  duets:3600,
  moomin:3200
};

export const calibrateHighValueEstimate=(input:{
  statisticalEstimate:number;
  noBreakSlug:string|null;
  earliestSeasonSlug:string|null;
  seasonCount:number;
  ultimateCount:number;
  packageCount:number;
  collaborationCount:number;
})=>{
  const inferredSlug=input.noBreakSlug||(input.seasonCount>=16?input.earliestSeasonSlug:null);
  const anchor=inferredSlug?vintageNoBreakAnchors[inferredSlug]||0:0;
  if(!anchor)return input.statisticalEstimate;
  const packagePremium=Math.max(0,input.packageCount-20)*700;
  const collaborationPremium=input.collaborationCount*900;
  const completionPremium=Math.max(0,input.ultimateCount-60)*500;
  return Math.max(input.statisticalEstimate,anchor+packagePremium+collaborationPremium+completionPremium);
};
