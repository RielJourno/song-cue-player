interface Props {
  message: string;
}

export default function Toast({ message }: Props) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#2a2a2a] text-white text-sm px-5 py-3 rounded-full shadow-lg z-50 whitespace-nowrap">
      {message}
    </div>
  );
}
