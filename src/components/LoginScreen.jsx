import { ROLE_LABELS } from '../data/demoData'

const roleOrder = ['ceo', 'deputy', 'manager', 'staff']

function LoginScreen({ users, onSelectUser, syncLabel, recentUserId }) {
  const groupedUsers = roleOrder.map((role) => ({
    role,
    title: ROLE_LABELS[role],
    users: users.filter((user) => user.role === role),
  }))

  const recentUser = users.find((user) => user.id === recentUserId)

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="login-copy">
          <p className="eyebrow">Business Demo Access</p>
          <h1>Đăng nhập vào hệ thống quản lý task phân cấp</h1>
          <p className="login-summary">
            Giao diện được tối ưu theo phong cách business: rõ tầng quản lý, dễ
            trình bày với khách hàng và phù hợp để demo luồng phân rã task nhiều cấp
            trên Firebase Realtime Database.
          </p>

          <div className="login-stat-grid">
            <article className="login-stat-card">
              <strong>{users.length}</strong>
              <span>Tài khoản demo</span>
            </article>
            <article className="login-stat-card">
              <strong>4</strong>
              <span>Cấp vai trò</span>
            </article>
            <article className="login-stat-card">
              <strong>Realtime</strong>
              <span>Đồng bộ tức thời</span>
            </article>
          </div>
        </div>

        <div className="login-command">
          {recentUser ? (
            <button
              type="button"
              className="recent-login-card"
              onClick={() => onSelectUser(recentUser.id)}
            >
              <span className="recent-login-label">Tài khoản gần đây</span>
              <strong>{recentUser.name}</strong>
              <p>
                {ROLE_LABELS[recentUser.role]} • {recentUser.department}
              </p>
              <span className="recent-login-action">Vào lại workspace</span>
            </button>
          ) : null}

          <div className="login-sidecard">
            <span className="status-dot"></span>
            <div>
              <strong>Môi trường demo đã sẵn sàng</strong>
              <p>{syncLabel || 'Ứng dụng sẽ tự seed và đồng bộ dữ liệu realtime.'}</p>
            </div>
          </div>

          <div className="login-sidecard soft">
            <div>
              <strong>Đăng nhập mặc định từ trang này</strong>
              <p>
                Mỗi lần mở ứng dụng sẽ luôn về trang login để thuận tiện cho việc
                trình diễn nhiều vai trò khác nhau.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="login-directory">
        <div className="directory-header">
          <div>
            <p className="eyebrow">User Directory</p>
            <h2>Chọn hồ sơ demo để truy cập</h2>
          </div>
          <span className="panel-count">Mock login theo vai trò</span>
        </div>

        <div className="login-grid">
          {groupedUsers.map((group) => (
            <div key={group.role} className="role-column">
              <div className="role-column-header">
                <div>
                  <p>{group.title}</p>
                  <small className="role-column-subtitle">
                    {group.role === 'ceo'
                      ? 'Khởi tạo task gốc và xem toàn hệ thống'
                      : group.role === 'deputy'
                        ? 'Nhận nhánh chiến lược và phân rã tiếp'
                        : group.role === 'manager'
                          ? 'Điều phối task theo phòng ban'
                          : 'Thực thi và cập nhật tiến độ'}
                  </small>
                </div>
                <span>{group.users.length} người</span>
              </div>

              <div className="user-card-list">
                {group.users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="user-card"
                    style={{ '--accent': user.accent }}
                    onClick={() => onSelectUser(user.id)}
                  >
                    <div className="avatar-chip">{user.name.slice(0, 1)}</div>
                    <div className="user-card-copy">
                      <strong>{user.name}</strong>
                      <span>{user.department}</span>
                      <small>
                        {group.title}
                        {user.managerId ? ' • Có quản lý trực tiếp' : ' • Cấp cao nhất'}
                      </small>
                    </div>
                    <span className="user-card-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default LoginScreen
