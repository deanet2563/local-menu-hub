import { supabase } from '../lib/supabase';

export type ShopReviewReply = {
  reply_id: string;
  review_id: string;
  shop_id: string;
  reply_text: string;
  created_at: string;
  updated_at: string;
};

export type ShopReview = {
  review_id: string;
  sub_id: string;
  shop_id: string;
  customer_id: string;
  rating: number;
  review_text: string | null;
  is_verified_order: boolean;
  created_at: string;
  shop_review_replies: ShopReviewReply[];
};

export async function loadShopReviews(shopId: string): Promise<ShopReview[]> {
  const { data, error } = await supabase
    .from('shop_order_reviews')
    .select('review_id,sub_id,shop_id,customer_id,rating,review_text,is_verified_order,created_at,shop_review_replies(reply_id,review_id,shop_id,reply_text,created_at,updated_at)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ShopReview[] | null) ?? [];
}

export async function saveShopReviewReply(review: ShopReview, replyText: string): Promise<void> {
  const text = replyText.trim();
  if (!text) throw new Error('กรุณาพิมพ์คำตอบรีวิว');
  if (text.length > 3000) throw new Error('คำตอบรีวิวยาวเกิน 3,000 ตัวอักษร');
  const existing = review.shop_review_replies?.[0];
  if (existing) {
    const { error } = await supabase
      .from('shop_review_replies')
      .update({ reply_text: text, updated_at: new Date().toISOString() })
      .eq('reply_id', existing.reply_id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('shop_review_replies').insert({
    review_id: review.review_id,
    shop_id: review.shop_id,
    reply_text: text,
  });
  if (error) throw error;
}

export function reviewSummary(reviews: ShopReview[]) {
  const count = reviews.length;
  const rating = count ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / count : 0;
  const verified = reviews.filter((review) => review.is_verified_order).length;
  return { count, rating, verified };
}
