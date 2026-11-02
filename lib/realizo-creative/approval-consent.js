// Avoid rejecting authenticated, explicitly approved projects solely because a
// previously cached Studio UI did not yet send the newly introduced checkbox.
// A caller supplying the checkbox explicitly must confirm it as true.
export function acceptsSellerConfirmation(body) {
 if(!body || typeof body!=='object' || Array.isArray(body))return false;
 return !Object.prototype.hasOwnProperty.call(body,'seller_claims_confirmed') ||
   body.seller_claims_confirmed===true;
}
