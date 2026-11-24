import { findPendingMigrations } from './pending-migrations';

describe('findPendingMigrations', () => {
  it('trả đúng migration trong repo mà DB chưa áp, theo thứ tự tên', () => {
    expect(
      findPendingMigrations(['b_two', 'a_one', 'c_three'], ['a_one']),
    ).toEqual(['b_two', 'c_three']);
  });

  it('DB đã áp đủ thì không báo gì (kể cả migration chỉ có ở DB)', () => {
    expect(findPendingMigrations(['a_one'], ['a_one', 'chi_co_o_db'])).toEqual([]);
  });
});
