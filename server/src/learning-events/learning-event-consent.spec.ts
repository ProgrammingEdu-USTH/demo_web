import { PHIEN_BAN_DONG_Y, trangThaiDongY } from './learning-event-consent';

describe('trangThaiDongY — luật đọc hàng đồng ý mới nhất', () => {
  it('chưa quyết lần nào: HỎI, và coi là CHƯA đồng ý (im lặng không phải đồng ý)', () => {
    expect(trangThaiDongY(null)).toEqual({
      granted: false,
      shouldAsk: true,
      version: PHIEN_BAN_DONG_Y,
    });
  });

  it('đã đồng ý đúng bản hiện tại: được ghi, không hỏi lại', () => {
    expect(
      trangThaiDongY({ granted: true, version: PHIEN_BAN_DONG_Y }),
    ).toEqual({
      granted: true,
      shouldAsk: false,
      version: PHIEN_BAN_DONG_Y,
    });
  });

  it('đã TỪ CHỐI đúng bản hiện tại: không ghi, và KHÔNG hỏi lại (hỏi lại là ép bằng sự phiền)', () => {
    expect(
      trangThaiDongY({ granted: false, version: PHIEN_BAN_DONG_Y }),
    ).toEqual({
      granted: false,
      shouldAsk: false,
      version: PHIEN_BAN_DONG_Y,
    });
  });

  it('đồng ý một bản mô tả CŨ: không kéo sang bản mới — hỏi lại, chưa được ghi', () => {
    expect(
      trangThaiDongY({ granted: true, version: 'ban-cu' }, 'ban-moi'),
    ).toEqual({
      granted: false,
      shouldAsk: true,
      version: 'ban-moi',
    });
  });
});
