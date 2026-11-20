// Pure formatting/error helpers only; the actual provider module is embedded unchanged.
export const activeProducts=[];
export class StoreError extends Error {constructor(message,status=400,code='INVALID_REQUEST'){super(message);this.status=status;this.code=code;}}
export const fail=(...args)=>{throw new StoreError(...args)};
export const money=n=>(n/100).toFixed(2);
