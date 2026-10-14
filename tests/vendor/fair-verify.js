// Pawn's public, dependency-free pawn-pf-v1 verifier. This file is also loaded
// by the Mini App. Every operation below runs locally with Web Crypto.
const encoder = new TextEncoder();
/** @param {Uint8Array} bytes */
const hex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
/** @param {string} value */
const bytes = value => Uint8Array.from((value.match(/../g) ?? []).map(pair => parseInt(pair, 16)));
/** @param {unknown} value */
const integer = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null;
/** @param {BufferSource} value */
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', value)));

/** @param {{target_rtp_ppm:string,base_rtp_ppm:string,segments:Array<{start:number,end:number,zone:string,min_multiplier_ppm:number,max_multiplier_ppm:number}>}} rules @param {number} roll */
export function craftRewardForRoll(rules, roll) {
  const segment = rules.segments.find(s => roll >= s.start && roll <= s.end);
  if (!segment) throw Error('Ни один диапазон крафта не включает этот ролл.');
  const min = BigInt(segment.min_multiplier_ppm), max = BigInt(segment.max_multiplier_ppm);
  const width = BigInt(segment.end - segment.start);
  const base = min + (width ? (max - min) * BigInt(roll - segment.start) / width : 0n);
  const target = BigInt(rules.target_rtp_ppm), reference = BigInt(rules.base_rtp_ppm);
  const ppm = target === reference ? base : (base * target + reference / 2n) / reference;
  return {zone:segment.zone,ppm};
}

/** @param {Array<{kind:string,amount:string,nft_rarity?:string,weight:number}>} rewards @param {number} roll */
export function caseRewardForRoll(rewards, roll) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100000) throw Error('Недопустимый ролл кейса.');
  if (rewards.reduce((sum,item)=>sum+item.weight,0)!==100000 || rewards.some(item=>!Number.isInteger(item.weight)||item.weight<1)) throw Error('Веса наград кейса неверны.');
  let total=0;
  const reward=rewards.find(item => (total += item.weight) > roll);
  if (!reward) throw Error('Веса наград кейса не покрывают ролл.');
  return reward;
}

/** @typedef {{name:string,status:string,detail:string}} VerificationStep */
/** @param {Record<string, any>} proof @param {Record<string, any> | null} [receipt] @returns {Promise<VerificationStep[]>} */
export async function verifyProof(proof, receipt = null) {
  /** @type {VerificationStep[]} */
  const steps = [];
  /** @param {string} name @param {string} status @param {string} detail */
  const add = (name, status, detail) => steps.push({ name, status, detail });
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) throw Error('Доказательство должно быть объектом JSON.');
  if (proof.version !== 'pawn-pf-v1') {
    add('Протокол', 'unsupported', 'Эта страница поддерживает pawn-pf-v1. Старые игры проверяются прежним способом через Random.org.');
    return steps;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.epoch_id ?? '') ||
      !/^[0-9a-f]{64}$/.test(proof.commitment ?? '') ||
      typeof proof.client_seed !== 'string' || !/^[ -~]{1,128}$/.test(proof.client_seed) ||
      !['craft'].includes(proof.domain) && !/^case:[a-z][a-z0-9_-]{0,63}$/.test(proof.domain ?? '') ||
      integer(proof.nonce) === null || integer(proof.block_counter) === null ||
      integer(proof.reference) === null || typeof proof.request_id !== 'string' || proof.request_id.length < 1 || proof.request_id.length > 128 ||
      !Number.isInteger(proof.roll) || proof.roll < 0 || proof.roll > 99999 ||
      !proof.rules || !proof.inputs || !proof.result || !/^[0-9a-f]{64}$/.test(proof.rules_hash ?? '')) {
    throw Error('В доказательстве отсутствуют поля протокола или они повреждены. Экспортируйте его из Pawn заново.');
  }
  if (receipt) {
    const isPlayReceipt = receipt.request_id !== undefined || receipt.rules_hash !== undefined || receipt.domain !== undefined;
    const clientSeedMatches = receipt.client_seed === proof.client_seed || (!isPlayReceipt && (receipt.client_seed === '' || receipt.client_seed === undefined));
    const matches = receipt.epoch_id === proof.epoch_id && receipt.commitment === proof.commitment &&
      (receipt.reference === undefined || String(receipt.reference) === proof.reference) &&
      (receipt.request_id === undefined || receipt.request_id === proof.request_id) &&
      clientSeedMatches;
    add('Сохранённый хеш', matches ? 'verified' : 'mismatch', matches ? 'Хеш, номер игры, ID запроса и клиентское зерно совпадают с сохранённым подтверждением. Время и источник сохранения проверьте самостоятельно.' : 'Эпоха, хеш, номер игры, ID запроса или клиентское зерно не совпадают с сохранённым подтверждением.');
    if (receipt.rules_hash || receipt.domain) {
      const rulesMatch=receipt.rules_hash===proof.rules_hash&&receipt.domain===proof.domain;
      add('Сохранённые правила и домен',rulesMatch?'verified':'mismatch',rulesMatch?'Правила и домен совпадают с вашим сохранённым подтверждением.':'Правила или домен отличаются от сохранённого подтверждения.');
    }
  }
  const rulesHash = await hash(encoder.encode(JSON.stringify(proof.rules)));
  add('Снимок правил', rulesHash === proof.rules_hash ? 'verified' : 'mismatch', rulesHash === proof.rules_hash ? 'Хеш правил совпадает с правилами в доказательстве.' : 'Снимок правил был изменён.');
  if (!proof.server_seed) {
    add('Зерно сервера', 'pending', 'Смените зерно и раскройте эту эпоху в Pawn, затем экспортируйте доказательство заново.');
    return steps;
  }
  if (!/^[0-9a-f]{64}$/.test(proof.server_seed)) throw Error('Раскрытое зерно должно состоять из 32 байт в виде строчных шестнадцатеричных символов.');
  const rawSeed = bytes(proof.server_seed);
  const commitment = await hash(rawSeed);
  add('Хеш сервера', commitment === proof.commitment ? 'verified' : 'mismatch', commitment === proof.commitment ? 'SHA-256 раскрытого зерна совпадает с опубликованным хешем.' : 'Раскрытое зерно не совпадает с опубликованным хешем.');
  if (commitment !== proof.commitment) return steps;
  const key = await crypto.subtle.importKey('raw', rawSeed, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  /** @type {number | undefined} */ let roll;
  /** @type {bigint | undefined} */ let acceptedBlock;
  const expectedBlock = integer(proof.block_counter);
  if (expectedBlock === null || expectedBlock > 100000n) throw Error('Номер блока слишком велик для проверки в браузере.');
  for (let block = 0n; block <= expectedBlock; block++) {
    const message = JSON.stringify(['pawn-pf-v1', proof.epoch_id, proof.domain, proof.client_seed, proof.nonce, String(block)]);
    const digest = new DataView(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
    for (let i = 0; i < 8; i++) {
      const word = digest.getUint32(i * 4, false);
      if (word < 4294900000) { roll = word % 100000; acceptedBlock = block; break; }
    }
    if (roll !== undefined) break;
  }
  const rollMatches = roll === proof.roll && acceptedBlock === expectedBlock;
  add('Ролл', rollMatches ? 'verified' : 'mismatch', rollMatches ? `HMAC с отбрасыванием неподходящих чисел даёт ${roll}.` : `Вычислено ${roll} в блоке ${acceptedBlock}; в доказательстве записано ${proof.roll} в блоке ${proof.block_counter}.`);
  let rewardMatches = false;
  try {
    if (proof.domain === 'craft') {
      const {zone,ppm} = craftRewardForRoll(proof.rules,proof.roll);
      const payout = BigInt(proof.inputs.bet_nano) * ppm / BigInt(proof.rules.multiplier_scale);
      /** @type {Array<{id:string,value_nano:string}>} */
      const gifts = proof.inputs.gifts;
      const stake = BigInt(proof.inputs.ton_bet_nano) + gifts.reduce((sum, gift) => sum + BigInt(gift.value_nano), 0n);
      rewardMatches = proof.result.zone === zone && BigInt(proof.result.multiplier_ppm) === ppm && BigInt(proof.result.payout_nano) === payout &&
        BigInt(proof.result.ton_payout_nano) + BigInt(proof.result.gift_payout_value_nano) === payout && stake === BigInt(proof.inputs.bet_nano);
    } else {
      if (proof.rules.kind !== proof.domain.slice(5)) throw Error('Вид кейса не совпадает с доменом.');
      /** @type {Array<{kind:string,amount:string,nft_rarity?:string,weight:number}>} */
      const rewards = proof.rules.rewards;
      const selected = caseRewardForRoll(rewards,proof.roll);
      rewardMatches = proof.result.kind === selected.kind && BigInt(proof.result.amount) === BigInt(selected.amount) &&
        (proof.result.nft_rarity || '') === (selected.nft_rarity || '') &&
        BigInt(proof.inputs.price_nano) === BigInt(proof.rules.price_nano);
    }
  } catch (error) {
    add('Записанная награда', 'mismatch', `Правила или суммы неверны: ${error instanceof Error ? error.message : String(error)}`);
    return steps;
  }
  add('Записанная награда', rewardMatches ? 'verified' : 'mismatch', rewardMatches ? 'Записанная награда соответствует роллу и сохранённым правилам.' : 'Записанная награда не соответствует сохранённым правилам.');
  return steps;
}
