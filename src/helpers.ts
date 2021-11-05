// Copyright (C) 2021 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

const msDay = 1000 * 60 * 60 * 24
export const toDays = (t: number): number => Math.ceil(t / msDay)

export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
