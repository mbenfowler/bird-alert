export interface Found { file: string; line: number; text: string }
export function scanFile(file: string): Found[]
export function scanAll(root?: string): Found[]
