import sys
from PIL import Image, ImageDraw
frames=[int(x) for x in sys.argv[1].split(',')]; comp=sys.argv[2] if len(sys.argv)>2 else 'MIMI'; out=sys.argv[3] if len(sys.argv)>3 else 'build/contact.png'
cols=5; w,h=324,576
rows=(len(frames)+cols-1)//cols
sheet=Image.new('RGB',(cols*w,rows*(h+28)),'white')
d=ImageDraw.Draw(sheet)
for i,f in enumerate(frames):
    im=Image.open(f'build/still_{comp}_{f}.png').convert('RGB').resize((w,h),Image.LANCZOS)
    x,y=(i%cols)*w,(i//cols)*(h+28)
    sheet.paste(im,(x,y+28)); d.text((x+6,y+6),f'f{f}  {f/30:.2f}s',fill='black')
sheet.save(out)
