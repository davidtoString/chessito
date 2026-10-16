import sets from './piece-sets.json';
// Piece sets: "classic" is drawn in code; every other id has 12 SVGs in /public/pieces/<id>/.
export type PieceSetInfo = { id: string; label: string; author: string; license: string; url: string; group: 'free' | 'open' | 'nc' };
export const pieceSetList = sets as PieceSetInfo[];
export const pieceGroups: { id: PieceSetInfo['group']; title: string; note: string }[] = [
 { id: 'free', title: 'Free to use', note: 'CC0, CC BY, MIT and Apache licenses. Credit is in Credits & licenses below.' },
 { id: 'open', title: 'Share-alike and GPL', note: 'CC BY-SA, GPL and AGPL: free to use, with the same license kept on the artwork.' },
 { id: 'nc', title: 'Non-commercial only', note: 'CC BY-NC-SA: fine for a personal site, not for anything commercial.' },
];
