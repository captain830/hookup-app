import { fixImageUrl } from '../utils/imageUrl';
export default function StatusCircle({ user, onView, isOwn = false }) {
    const hasUnviewed = !isOwn && user.statuses?.some(s => !s.viewed_by_me);
    const latestStatus = user.statuses?.[0];
    
    return (
        <button
            onClick={() => onView(user)}
            className="flex flex-col items-center space-y-1 group flex-shrink-0"
        >
            <div className={`relative w-16 h-16 rounded-full p-0.5 ${
                hasUnviewed ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-gray-600'
            }`}>
                <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                    {user.user_photo && user.user_photo[0] ? (
                        <img 
                            src={fixImageUrl(user.user_photo?.[0])}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `
                                    <div class="w-full h-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                                        <span class="text-white text-xl font-bold">${user.name?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                `;
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-xl font-bold">
                                {user.name?.charAt(0)?.toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
                {isOwn && user.statuses?.length > 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border-2 border-black">
                        {user.statuses.length}
                    </div>
                )}
            </div>
            <span className="text-xs text-gray-300 max-w-[70px] truncate">{user.name}</span>
        </button>
    );
}