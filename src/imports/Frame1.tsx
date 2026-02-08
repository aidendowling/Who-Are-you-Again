import imgMarcelStraussYWuDcnXjLkUnsplash1 from "figma:asset/555c0dbdf8e4d07301d5ff5c75b2888e8dd02850.png";

function ButtonGlobal() {
  return (
    <div
      className="absolute bg-[rgba(252,179,244,0.05)] box-border content-stretch flex flex-row gap-0.5 items-center justify-center left-1/2 px-[22px] py-3 rounded-[38px] translate-x-[-50%] translate-y-[-50%]"
      data-name="Button-global"
      style={{ top: "calc(50% - 0.5px)" }}
    >
      <div className="flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[20px] text-center text-nowrap tracking-[-0.7px]">
        <p className="adjustLetterSpacing block leading-[1.4] whitespace-pre">
          I’m feeling lucky
        </p>
      </div>
    </div>
  );
}

export default function Frame1() {
  return (
    <div className="bg-[#ffffff] relative size-full">
      <div
        className="absolute bg-center bg-cover bg-no-repeat h-[329px] left-0 top-0 w-[493px]"
        data-name="marcel-strauss-Y-wuDcnXJLk-unsplash 1"
        style={{
          backgroundImage: `url('${imgMarcelStraussYWuDcnXjLkUnsplash1}')`,
        }}
      />
      <ButtonGlobal />
    </div>
  );
}